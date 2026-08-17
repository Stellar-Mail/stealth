export function assignWorkload({ teamMembers, workItems }) {
  if (!Array.isArray(teamMembers)) {
    throw new TypeError("teamMembers must be an array");
  }
  if (!Array.isArray(workItems)) {
    throw new TypeError("workItems must be an array");
  }

  const members = teamMembers.map((member) => ({
    ...member,
    currentLoad: typeof member.currentLoad === "number" ? member.currentLoad : 0,
    capacity: typeof member.capacity === "number" ? member.capacity : 40,
    skills: new Set(Array.isArray(member.skills) ? member.skills : []),
  }));

  const tasks = workItems.map((item) => ({
    ...item,
    effort: typeof item.effort === "number" ? item.effort : 1,
    priority: typeof item.priority === "number" ? item.priority : 0,
    requiredSkills: new Set(Array.isArray(item.requiredSkills) ? item.requiredSkills : []),
  }));

  tasks.sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    return a.effort - b.effort;
  });

  return tasks.map((task) => {
    const skillMatches = members.filter((member) => {
      if (task.requiredSkills.size === 0) {
        return true;
      }
      for (const skill of task.requiredSkills) {
        if (!member.skills.has(skill)) {
          return false;
        }
      }
      return true;
    });

    const eligible = skillMatches.filter(
      (member) => member.currentLoad + task.effort <= member.capacity,
    );

    const hasRequiredSkill = task.requiredSkills.size === 0 || skillMatches.length > 0;
    const assignee = chooseBestMember(eligible);
    const assignment = {
      taskId: task.taskId,
      assigneeId: assignee?.memberId ?? null,
      assigneeName: assignee?.name ?? null,
      status: assignee ? "assigned" : "unassigned",
      reason: assignee ? "matched" : hasRequiredSkill ? "capacity" : "skill mismatch",
      effort: task.effort,
      priority: task.priority,
      requiredSkills: Array.from(task.requiredSkills),
    };

    if (assignee) {
      assignee.currentLoad += task.effort;
    }

    return assignment;
  });
}

function chooseBestMember(members) {
  if (members.length === 0) {
    return null;
  }

  return members.reduce((winner, member) => {
    if (!winner) {
      return member;
    }

    if (member.currentLoad !== winner.currentLoad) {
      return member.currentLoad < winner.currentLoad ? member : winner;
    }

    return member.capacity > winner.capacity ? member : winner;
  }, null);
}
