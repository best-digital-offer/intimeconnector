import { McpServer, createMcpHandler } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { db } from '../db/store.js';
import { resolveUserFromToken } from '../security/auth.js';
import { executeTransformation } from './transformationEngine.js';
import { executeExternalRequest } from './requestEngine.js';

export const MCP_ANNOTATIONS = {
  get_profile: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
  list_connections: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
  get_connection: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
  transform_payload: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
  test_connection: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
  send_webhook: { readOnlyHint: false, openWorldHint: false, destructiveHint: true },
  get_request_status: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
  list_recent_requests: { readOnlyHint: true, openWorldHint: false, destructiveHint: false }
} as const;

const descriptions = {
  get_profile: 'Show the authenticated account plan and usage summary. Does not return email, secrets, or internal identifiers.',
  list_connections: 'List the authenticated user’s saved connection names and safe configuration metadata. Never returns credentials or database IDs.',
  get_connection: 'Inspect one of the authenticated user’s saved connections by name. Never returns credentials or internal database identifiers.',
  transform_payload: 'Preview how saved transformation rules convert supplied text or JSON. Makes no external request.',
  test_connection: 'Send a non-production test request through one saved connection and return sanitized status and latency.',
  send_webhook: 'Transform and send data through one saved connection. This can change state in an external service and consumes account quota.',
  get_request_status: 'Show sanitized status metadata for one request executed by the authenticated account.',
  list_recent_requests: 'List recent sanitized request metadata for the authenticated account.'
} as const;

function authVerifier() {
  return {
    async verifyAccessToken(token: string) {
      const user = await resolveUserFromToken(token);
      if (!user) throw new Error('Invalid access token');
      return {
        token,
        clientId: 'mcp-client',
        scopes: ['mcp'],
        expiresAt: Math.floor(Date.now()/1000)+300,
        extra: { userId: user.id }
      };
    }
  };
}

async function authenticatedUser(authInfo: any) {
  const userId = String(authInfo?.extra?.userId || '');
  if (!userId) throw new Error('Authentication required.');
  const user = await db.getProfileById(userId);
  if (!user) throw new Error('Authentication required.');
  return user;
}

export const createMcpServer = (authInfo?: any) => {
  const server = new McpServer(
    { name: 'just-in-time-connector', version: '1.0.0', websiteUrl: process.env.APP_BASE_URL || undefined },
    { capabilities: { tools: {} } }
  );

  const profileHandler = async () => {
    const user = await authenticatedUser(authInfo);
    const sub = await db.getSubscriptionByUserId(user.id);
    const plan = sub ? await db.getPlanById(sub.plan_id) : await db.getPlanById('plan_free');
    const usage = await db.getUsageByUserId(user.id);
    const connections = await db.getConnectionsByUserId(user.id);
    return {
      content: [{ type: 'text', text: JSON.stringify({
        plan: plan?.name || 'Free',
        plan_tier: plan?.tier || 'free',
        subscription_status: sub?.status || 'active',
        actions_used: usage.actions_count,
        actions_limit: usage.actions_limit,
        remaining_actions: Math.max(0, usage.actions_limit - usage.actions_count),
        connection_count: connections.length
      }) }],
      _meta: { 'openai/profile': true }
    };
  };

  server.registerTool('get_profile', {
    description: descriptions.get_profile,
    inputSchema: z.object({}),
    annotations: MCP_ANNOTATIONS.get_profile
  }, profileHandler);

  server.registerTool('list_connections', {
    description: descriptions.list_connections,
    inputSchema: z.object({}),
    annotations: MCP_ANNOTATIONS.list_connections
  }, async () => {
    const user = await authenticatedUser(authInfo);
    const list = await db.getConnectionsByUserId(user.id);
    return { content: [{ type: 'text', text: JSON.stringify(list.map(c => ({
      name: c.name, description: c.description, endpoint_domain: new URL(c.endpoint_url).hostname,
      http_method: c.http_method, auth_type: c.auth_type, status: c.status, last_test_status: c.last_test_status
    }))) }] };
  });

  server.registerTool('get_connection', {
    description: descriptions.get_connection,
    inputSchema: z.object({ connection_name: z.string().min(1).max(100) }),
    annotations: MCP_ANNOTATIONS.get_connection
  }, async ({ connection_name }) => {
    const user = await authenticatedUser(authInfo);
    const connection = (await db.getConnectionsByUserId(user.id)).find(c => c.name.toLowerCase() === connection_name.toLowerCase());
    if (!connection) throw new Error('Connection not found.');
    return { content: [{ type:'text', text: JSON.stringify({
      name:connection.name, description:connection.description, endpoint_domain:new URL(connection.endpoint_url).hostname,
      http_method:connection.http_method, auth_type:connection.auth_type, status:connection.status,
      timeout_ms:connection.timeout_ms,retry_count:connection.retry_count
    }) }] };
  });

  server.registerTool('transform_payload', {
    description: descriptions.transform_payload,
    inputSchema: z.object({
      raw_input: z.string().min(1).max(100_000),
      transformation_name: z.string().max(100).optional()
    }),
    annotations: MCP_ANNOTATIONS.transform_payload
  }, async ({ raw_input, transformation_name }) => {
    const user=await authenticatedUser(authInfo);
    const transformations=await db.getTransformationsByUserId(user.id);
    const transformation=transformation_name
      ? transformations.find(t=>t.name.toLowerCase()===transformation_name.toLowerCase())
      : transformations[0];
    if(!transformation) throw new Error('No saved transformation found.');
    const output=await executeTransformation(transformation,raw_input);
    return { content:[{type:'text',text:JSON.stringify(output)}] };
  });

  server.registerTool('test_connection', {
    description: descriptions.test_connection,
    inputSchema: z.object({ connection_name:z.string().min(1).max(100) }),
    annotations: MCP_ANNOTATIONS.test_connection
  }, async ({connection_name})=>{
    const user=await authenticatedUser(authInfo);
    const c=(await db.getConnectionsByUserId(user.id)).find(x=>x.name.toLowerCase()===connection_name.toLowerCase());
    if(!c) throw new Error('Connection not found.');
    const result=await executeExternalRequest({userId:user.id,connection:c,payload:{ping:'jitc_test_probe',timestamp:new Date().toISOString()},actionType:'test_run'});
    return {content:[{type:'text',text:JSON.stringify({success:result.success,http_status:result.httpStatus,duration_ms:result.durationMs,request_id:result.requestId})}]};
  });

  server.registerTool('send_webhook', {
    description: descriptions.send_webhook,
    inputSchema: z.object({
      connection_name:z.string().min(1).max(100),
      data:z.string().min(1).max(100_000),
      transformation_name:z.string().max(100).optional(),
      idempotency_key:z.string().min(8).max(128).optional()
    }),
    annotations: MCP_ANNOTATIONS.send_webhook
  }, async ({connection_name,data,transformation_name,idempotency_key})=>{
    const user=await authenticatedUser(authInfo);
    const c=(await db.getConnectionsByUserId(user.id)).find(x=>x.name.toLowerCase()===connection_name.toLowerCase());
    if(!c) throw new Error('Connection not found.');
    const transformations=await db.getTransformationsByUserId(user.id);
    const t=transformation_name ? transformations.find(x=>x.name.toLowerCase()===transformation_name.toLowerCase()) : transformations.find(x=>x.connection_id===c.id);
    const payload=t ? await executeTransformation(t,data) : data;
    const result=await executeExternalRequest({userId:user.id,connection:c,payload,transformationId:t?.id,actionType:'mcp_tool',idempotencyKey:idempotency_key});
    return {content:[{type:'text',text:JSON.stringify({success:result.success,http_status:result.httpStatus,duration_ms:result.durationMs,request_id:result.requestId,response_preview:result.safeResponsePreview,error:result.errorMessage})}]};
  });

  server.registerTool('get_request_status', {
    description: descriptions.get_request_status,
    inputSchema: z.object({ request_id:z.string().min(1).max(100) }),
    annotations: MCP_ANNOTATIONS.get_request_status
  }, async ({request_id})=>{
    const user=await authenticatedUser(authInfo); const request=await db.getRequestById(request_id,user.id);
    if(!request) throw new Error('Request not found.');
    return {content:[{type:'text',text:JSON.stringify({status:request.status,http_status:request.http_status,duration_ms:request.duration_ms,attempts:request.attempts_count,error:request.error_message||undefined})}]};
  });

  server.registerTool('list_recent_requests', {
    description: descriptions.list_recent_requests,
    inputSchema: z.object({ limit:z.number().int().min(1).max(20).default(5) }),
    annotations: MCP_ANNOTATIONS.list_recent_requests
  }, async ({limit})=>{
    const user=await authenticatedUser(authInfo); const requests=await db.getRequestsByUserId(user.id,limit);
    return {content:[{type:'text',text:JSON.stringify(requests.map(r=>({status:r.status,http_status:r.http_status,duration_ms:r.duration_ms,endpoint_domain:r.endpoint_domain,created_at:r.created_at,request_id:r.id}))) } ]};
  });

  return server;
};

const mcpHandler = createMcpHandler((context) => createMcpServer(context.authInfo));
const nodeHandlerPromise = import('@modelcontextprotocol/node').then(({ toNodeHandler }) => toNodeHandler(mcpHandler));

export async function handleMcpRequest(req: any, res: any) {
  const metadata = (process.env.OAUTH_ISSUER || process.env.MCP_BASE_URL || process.env.APP_BASE_URL || '') + '/.well-known/oauth-protected-resource';
  const token = String(req.headers.authorization || '').replace(/^Bearer\\s+/i, '');
  try {
    const auth = await authVerifier().verifyAccessToken(token);
    req.auth = auth;
    const nodeHandler = await nodeHandlerPromise;
    return nodeHandler(req, res, req.body);
  } catch {
    res.setHeader('WWW-Authenticate', 'Bearer realm="just-in-time-connector", resource_metadata="' + metadata + '"');
    return res.status(401).json({ error: 'invalid_token' });
  }
}

export async function handleMcpHttp(req: Request) {
  const authHeader=req.headers.get('authorization');
  const verifier=authVerifier();
  const auth=await verifier.verifyAccessToken(authHeader?.replace(/^Bearer\s+/i,'')||'');
  if(!auth) return new Response('Unauthorized',{status:401});
  return mcpHandler.fetch(req,{authInfo:auth});
}
