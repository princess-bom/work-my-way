import { demoHttpResponse } from '../../server/demo-http.js';
import { handleDemoRequest } from '../../server/vercel-handler.js';
export default handleDemoRequest('start', demoHttpResponse);
