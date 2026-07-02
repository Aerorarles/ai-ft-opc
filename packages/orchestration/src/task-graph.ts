class TaskGraphBuilder {
  build(tasks) {
    const graph = new Map();

    for (const task of tasks) {
      if (graph.has(task.id)) {
        throw new Error(`Duplicate task id: ${task.id}`);
      }

      graph.set(task.id, {
        ...task,
        dependsOn: task.dependsOn || [],
        state: "PENDING",
      });
    }

    for (const task of graph.values()) {
      for (const dependencyId of task.dependsOn) {
        if (!graph.has(dependencyId)) {
          throw new Error(`Task ${task.id} depends on missing task ${dependencyId}`);
        }
      }
    }

    this.assertAcyclic(graph);
    return graph;
  }

  assertAcyclic(graph) {
    const visiting = new Set();
    const visited = new Set();

    const visit = (taskId) => {
      if (visited.has(taskId)) {
        return;
      }
      if (visiting.has(taskId)) {
        throw new Error(`Task graph contains a cycle at ${taskId}`);
      }

      visiting.add(taskId);
      const task = graph.get(taskId);
      if (!task) {
        throw new Error(`Missing task ${taskId}`);
      }

      for (const dependencyId of task.dependsOn) {
        visit(dependencyId);
      }

      visiting.delete(taskId);
      visited.add(taskId);
    };

    for (const taskId of graph.keys()) {
      visit(taskId);
    }
  }
}

module.exports = {
  TaskGraphBuilder,
};
