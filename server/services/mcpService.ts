import { Request, Response } from 'express';
import { db } from '../db/store';
import { resolveUserFromToken } from '../security/auth';
import { executeTransformation } from './transformationEngine';
import { executeExternalRequest } from './requestEngine';
import { redactSensitiveData } from '../security/crypto';

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: {
    readOnlyHint: boolean;
    openWorldHint: boolean;
    destructiveHint: boolean;
  };
  annotationJustification: string;
}

export const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'get_profile',
    description: 'Returns the authenticated account identity, active plan, remaining monthly action quota, and connection stats.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
    annotationJustification:
      'Reads only local account profile and subscription limits from the database without querying external systems or mutating state.',
  },
  {
    name: 'list_connections',
    description: 'Lists all active API and webhook connections configured by the authenticated user with safe metadata (name, endpoint domain, method, status). Never exposes credentials.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
    annotationJustification:
      'Fetches connection metadata scoped strictly to the authenticated user from the local database. Does not trigger external calls.',
  },
  {
    name: 'get_connection',
    description: 'Retrieves configuration details of a specific connection by ID or name, excluding secrets.',
    inputSchema: {
      type: 'object',
      properties: {
        connection_id: {
          type: 'string',
          description: 'The unique ID or name of the connection to inspect',
        },
      },
      required: ['connection_id'],
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
    annotationJustification:
      'Reads connection specifications for an owned connection without contacting third parties or altering records.',
  },
  {
    name: 'transform_payload',
    description: 'Dry-run transformation: Takes raw input (natural language text or JSON) and applies a saved transformation or default rules to preview the structured output without sending any network request.',
    inputSchema: {
      type: 'object',
      properties: {
        raw_input: {
          type: 'string',
          description: 'The natural language summary or JSON input to transform',
        },
        transformation_id: {
          type: 'string',
          description: 'Optional ID of a saved transformation rule set to use',
        },
      },
      required: ['raw_input'],
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
    annotationJustification:
      'Pure computation. Parses or transforms input into structured JSON in-memory without making outbound requests or mutating persistent state.',
  },
  {
    name: 'test_connection',
    description: 'Performs a safe, non-destructive health test ping against a saved connection endpoint and returns HTTP response code, latency, and sanitized status.',
    inputSchema: {
      type: 'object',
      properties: {
        connection_id: {
          type: 'string',
          description: 'The connection ID to test',
        },
      },
      required: ['connection_id'],
    },
    annotations: {
      readOnlyHint: false,
      openWorldHint: true,
      destructiveHint: false,
    },
    annotationJustification:
      'Makes an outbound HTTP network request to an external third-party service (openWorld=true), but is intended as a test probe and does not consume production quotas (destructive=false).',
  },
  {
    name: 'send_webhook',
    description: 'Securely transforms and dispatches data through a saved user connection to an external API or webhook. Validates SSRF, attaches encrypted credentials server-side, executes request, and logs audit record.',
    inputSchema: {
      type: 'object',
      properties: {
        connection_id: {
          type: 'string',
          description: 'The ID or name of the saved connection (e.g. CRM, Slack, Webhook)',
        },
        data: {
          type: 'string',
          description: 'Natural language text or JSON string containing the data/lead/summary to send',
        },
        transformation_id: {
          type: 'string',
          description: 'Optional specific transformation ID to apply. If omitted, matching transformation or automatic extraction is applied.',
        },
        idempotency_key: {
          type: 'string',
          description: 'Optional client-provided idempotency key to prevent duplicate execution',
        },
      },
      required: ['connection_id', 'data'],
    },
    annotations: {
      readOnlyHint: false,
      openWorldHint: true,
      destructiveHint: true,
    },
    annotationJustification:
      'Mutates external third-party state (POST/PUT/DELETE to external CRMs, webhooks, or databases) and consumes monthly quota units. Correctly tagged destructiveHint=true.',
  },
  {
    name: 'get_request_status',
    description: 'Retrieves the status, duration, and sanitized execution outcome of a previously dispatched request by Request ID.',
    inputSchema: {
      type: 'object',
      properties: {
        request_id: {
          type: 'string',
          description: 'The unique request ID (e.g., req_...)',
        },
      },
      required: ['request_id'],
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
    annotationJustification:
      'Reads execution log metadata owned by the user from the database. Does not reach external systems or modify data.',
  },
  {
    name: 'list_recent_requests',
    description: 'Returns the authenticated user’s recent API and webhook request history with sanitized metadata (status, latency, target domain, timestamp).',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of recent requests to return (default 5, max 20)',
        },
      },
      required: [],
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
    annotationJustification:
      'Read-only database query for recent request audit records belonging strictly to the authenticated user.',
  },
];

/**
 * Handle Streamable HTTP MCP JSON-RPC requests
 */
export async function handleMcpRequest(req: Request, res: Response) {
  // Support both GET (protocol ping / SSE if requested) and POST (JSON-RPC)
  if (req.method === 'GET') {
    return res.status(200).json({
      protocol: 'mcp-streamable-http',
      version: '2024-11-05',
      name: 'Just-in-Time Connector MCP Server',
      status: 'online',
      tools_available: MCP_TOOLS.length,
      documentation_url: '/docs#mcp',
    });
  }

  const { jsonrpc, id, method, params } = req.body || {};

  if (jsonrpc !== '2.0') {
    return res.status(400).json({
      jsonrpc: '2.0',
      id: id ?? null,
      error: { code: -32600, message: 'Invalid Request: jsonrpc must be "2.0"' },
    });
  }

  // 1. Initialize
  if (method === 'initialize') {
    return res.status(200).json({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {
            listChanged: false,
          },
        },
        serverInfo: {
          name: 'just-in-time-connector',
          version: '1.0.0',
        },
      },
    });
  }

  // 2. Notifications (e.g. notifications/initialized)
  if (method === 'notifications/initialized') {
    return res.status(204).end();
  }

  // 3. Ping
  if (method === 'ping') {
    return res.status(200).json({
      jsonrpc: '2.0',
      id,
      result: {},
    });
  }

  // 4. Tools/List
  if (method === 'tools/list') {
    return res.status(200).json({
      jsonrpc: '2.0',
      id,
      result: {
        tools: MCP_TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
          annotations: t.annotations,
        })),
      },
    });
  }

  // 5. Tools/Call
  if (method === 'tools/call') {
    const { name, arguments: toolArgs = {} } = params || {};

    // Authentication: Extract user from Authorization Bearer header
    const authHeader = req.headers.authorization;
    const user = resolveUserFromToken(authHeader);

    if (!user) {
      db.logSecurityEvent({
        event_type: 'invalid_token',
        severity: 'high',
        details: { tool: name, method: 'tools/call' },
        ip_address: req.ip || '127.0.0.1',
        blocked: true,
      });

      return res.status(200).json({
        jsonrpc: '2.0',
        id,
        result: {
          isError: true,
          content: [
            {
              type: 'text',
              text: 'Authentication required. Please authorize your Just-in-Time Connector account using OAuth or provide a valid Bearer token.',
            },
          ],
        },
      });
    }

    try {
      const resultText = await executeMcpTool(name, toolArgs, user.id);
      return res.status(200).json({
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: resultText,
            },
          ],
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(200).json({
        jsonrpc: '2.0',
        id,
        result: {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Tool execution error: ${msg}`,
            },
          ],
        },
      });
    }
  }

  return res.status(404).json({
    jsonrpc: '2.0',
    id,
    error: { code: -32601, message: `Method '${method}' not found` },
  });
}

/**
 * Executes a tool securely with authenticated user scoping
 */
async function executeMcpTool(
  toolName: string,
  args: Record<string, unknown>,
  userId: string
): Promise<string> {
  switch (toolName) {
    case 'get_profile': {
      const user = db.getProfileById(userId);
      const sub = db.getSubscriptionByUserId(userId);
      const plan = sub ? db.getPlanById(sub.plan_id) : db.getPlans()[0];
      const usage = db.getUsageByUserId(userId);
      const connections = db.getConnectionsByUserId(userId);

      return JSON.stringify(
        {
          account: {
            name: user?.name,
            email: user?.email,
          },
          subscription: {
            plan_name: plan?.name,
            tier: plan?.tier,
            status: sub?.status,
            period_end: sub?.current_period_end,
          },
          usage: {
            actions_used: usage.actions_count,
            monthly_limit: usage.actions_limit,
            remaining_actions: Math.max(0, usage.actions_limit - usage.actions_count),
          },
          connections_count: connections.length,
        },
        null,
        2
      );
    }

    case 'list_connections': {
      const connections = db.getConnectionsByUserId(userId);
      const safeList = connections.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        endpoint_domain: new URL(c.endpoint_url).hostname,
        http_method: c.http_method,
        auth_type: c.auth_type,
        status: c.status,
        last_test_status: c.last_test_status,
      }));

      return JSON.stringify({ connections: safeList }, null, 2);
    }

    case 'get_connection': {
      const connId = String(args.connection_id || '');
      let connection = db.getConnectionById(connId, userId);
      if (!connection) {
        // Fallback: match by name
        connection = db.getConnectionsByUserId(userId).find(
          (c) => c.name.toLowerCase() === connId.toLowerCase()
        );
      }

      if (!connection) {
        throw new Error(`Connection '${connId}' not found or access denied.`);
      }

      return JSON.stringify(
        {
          id: connection.id,
          name: connection.name,
          description: connection.description,
          endpoint_domain: new URL(connection.endpoint_url).hostname,
          http_method: connection.http_method,
          auth_type: connection.auth_type,
          status: connection.status,
          timeout_ms: connection.timeout_ms,
          retry_count: connection.retry_count,
          last_tested_at: connection.last_tested_at,
        },
        null,
        2
      );
    }

    case 'transform_payload': {
      const rawInput = String(args.raw_input || '');
      const transId = args.transformation_id ? String(args.transformation_id) : undefined;

      let transformation = transId ? db.getTransformationById(transId, userId) : undefined;
      if (!transformation) {
        // Pick the first available transformation for user or create transient default
        const list = db.getTransformationsByUserId(userId);
        transformation = list[0] || {
          id: 'trans_default',
          user_id: userId,
          name: 'Default Natural Language Extractor',
          description: 'Extracts structured lead & client entities',
          mode: 'visual',
          rules: [],
          sample_input: '',
          version: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }

      const structured = await executeTransformation(transformation, rawInput);
      return JSON.stringify({ transformed_payload: structured }, null, 2);
    }

    case 'test_connection': {
      const connId = String(args.connection_id || '');
      let connection = db.getConnectionById(connId, userId);
      if (!connection) {
        connection = db.getConnectionsByUserId(userId).find(
          (c) => c.name.toLowerCase() === connId.toLowerCase()
        );
      }

      if (!connection) {
        throw new Error(`Connection '${connId}' not found or access denied.`);
      }

      const testResult = await executeExternalRequest({
        userId,
        connection,
        payload: { ping: 'jitc_mcp_test', timestamp: new Date().toISOString() },
        actionType: 'test_run',
      });

      return JSON.stringify(
        {
          connection_name: connection.name,
          status: testResult.success ? 'HEALTHY' : 'UNREACHABLE',
          http_status: testResult.httpStatus,
          latency_ms: testResult.durationMs,
          error: testResult.errorMessage,
        },
        null,
        2
      );
    }

    case 'send_webhook': {
      const connId = String(args.connection_id || '');
      const rawData = String(args.data || '');
      const transId = args.transformation_id ? String(args.transformation_id) : undefined;
      const idempotencyKey = args.idempotency_key ? String(args.idempotency_key) : undefined;

      let connection = db.getConnectionById(connId, userId);
      if (!connection) {
        connection = db.getConnectionsByUserId(userId).find(
          (c) => c.name.toLowerCase() === connId.toLowerCase()
        );
      }

      if (!connection) {
        throw new Error(`Connection '${connId}' not found or access denied.`);
      }

      // Check usage limits beforehand
      const usage = db.getUsageByUserId(userId);
      if (usage.actions_count >= usage.actions_limit) {
        return JSON.stringify({
          success: false,
          error: `Monthly quota exceeded (${usage.actions_count}/${usage.actions_limit} actions). Visit your account's plan page on the website to upgrade.`,
        });
      }

      // Apply transformation if applicable
      let payloadToSend: Record<string, unknown> | string = rawData;
      let transformation = transId ? db.getTransformationById(transId, userId) : undefined;
      if (!transformation) {
        // Look for connection-associated transformation
        const associated = db.getTransformationsByUserId(userId).find(
          (t) => t.connection_id === connection!.id
        );
        transformation = associated;
      }

      if (transformation) {
        payloadToSend = await executeTransformation(transformation, rawData);
      } else {
        // Try parsing JSON or extract with NLP
        try {
          payloadToSend = JSON.parse(rawData);
        } catch {
          const defaultTrans = db.getTransformationsByUserId(userId)[0];
          if (defaultTrans) {
            payloadToSend = await executeTransformation(defaultTrans, rawData);
          }
        }
      }

      // Execute request safely through request engine
      const execResult = await executeExternalRequest({
        userId,
        connection,
        payload: payloadToSend,
        transformationId: transformation?.id,
        actionType: 'mcp_tool',
        idempotencyKey,
      });

      return JSON.stringify(
        {
          success: execResult.success,
          connection: connection.name,
          request_id: execResult.requestId,
          http_status: execResult.httpStatus,
          duration_ms: execResult.durationMs,
          payload_preview: redactSensitiveData(payloadToSend),
          response_preview: execResult.safeResponsePreview,
          error: execResult.errorMessage,
        },
        null,
        2
      );
    }

    case 'get_request_status': {
      const reqId = String(args.request_id || '');
      const reqRecord = db.getRequestById(reqId, userId);
      if (!reqRecord) {
        throw new Error(`Request '${reqId}' not found or access denied.`);
      }

      return JSON.stringify(
        {
          request_id: reqRecord.id,
          status: reqRecord.status,
          http_status: reqRecord.http_status,
          duration_ms: reqRecord.duration_ms,
          endpoint_domain: reqRecord.endpoint_domain,
          created_at: reqRecord.created_at,
          error: reqRecord.error_message,
        },
        null,
        2
      );
    }

    case 'list_recent_requests': {
      const limit = Math.min(Math.max(Number(args.limit || 5), 1), 20);
      const requests = db.getRequestsByUserId(userId, limit);
      const safe = requests.map((r) => ({
        id: r.id,
        connection_id: r.connection_id,
        status: r.status,
        http_status: r.http_status,
        duration_ms: r.duration_ms,
        endpoint_domain: r.endpoint_domain,
        action_type: r.action_type,
        created_at: r.created_at,
      }));

      return JSON.stringify({ recent_requests: safe }, null, 2);
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
