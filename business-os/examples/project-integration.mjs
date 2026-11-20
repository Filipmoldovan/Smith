import {smithOsClient} from '../src/client.mjs';
/** Example to call from an existing server/backend, NEVER from browser or build pipeline without an explicit business decision. */
export async function verifySmithOsConnection(){
  const client=smithOsClient({baseUrl:process.env.SMITH_OS_BASE_URL,token:process.env.SMITH_OS_API_TOKEN,projectId:process.env.SMITH_OS_PROJECT_ID});
  return client.getMetrics(new Date().toISOString().slice(0,7));
}
