import {
  AttemptRequestSchema,
  RunRequestSchema,
  TeacherDecisionRequestSchema
} from '../shared/demo-api.js';
import { DemoRunNotFoundError, demoService } from './demo-service.js';

type DemoAction = 'start' | 'state' | 'attempts' | 'teacher-decisions' | 'reset';

export async function demoHttpResponse(action: DemoAction, body: unknown) {
  try {
    if (action === 'start') return { status: 200, body: await demoService.start() };
    if (action === 'state') {
      const request = RunRequestSchema.parse(body);
      return { status: 200, body: await demoService.get(request.runId) };
    }
    if (action === 'attempts') {
      const request = AttemptRequestSchema.parse(body);
      return { status: 200, body: await demoService.recordAttempt(request.runId, request.attempt) };
    }
    if (action === 'teacher-decisions') {
      const request = TeacherDecisionRequestSchema.parse(body);
      return {
        status: 200,
        body: await demoService.recordTeacherDecision(request.runId, request.decision)
      };
    }
    const request = RunRequestSchema.parse(body);
    return { status: 200, body: await demoService.reset(request.runId) };
  } catch (error) {
    return {
      status: error instanceof DemoRunNotFoundError ? 404 : 400,
      body: {
        error: error instanceof DemoRunNotFoundError ? 'demo_run_not_found' : 'invalid_request',
        message: error instanceof Error ? error.message : 'The request could not be processed.'
      }
    };
  }
}
