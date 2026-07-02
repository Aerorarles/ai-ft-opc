export type OrchestrationEvent =
  | {
      type: "TASK_CREATED";
      execution_id: string;
      task_id: string;
      agent_type?: string;
    }
  | {
      type: "TASK_READY";
      execution_id: string;
      task_id: string;
      agent_type?: string;
    }
  | {
      type: "TASK_STARTED";
      execution_id: string;
      task_id: string;
      agent_type?: string;
    }
  | {
      type: "TASK_COMPLETED";
      execution_id: string;
      task_id: string;
      agent_type?: string;
      result: any;
    }
  | {
      type: "TASK_FAILED";
      execution_id: string;
      task_id: string;
      agent_type?: string;
      error: string;
    }
  | {
      type: "EXECUTION_COMPLETED";
      execution_id: string;
    };
