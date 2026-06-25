import { Project, AutoBindingRule, ProjectMailBinding } from "../types";
import type { Email } from "@/components/mail/data";

/**
 * Service representing the business layer of Project Mail Binder.
 * Operates entirely isolated on local fixtures and memory-based storage.
 */
export class ProjectBinderService {
  private projects: Map<string, Project> = new Map();
  private emailBindings: Map<string, Set<string>> = new Map(); // emailId -> Set<projectId>
  private projectBindings: Map<string, Set<string>> = new Map(); // projectId -> Set<emailId>

  constructor(initialProjects: Project[] = []) {
    initialProjects.forEach((proj) => {
      this.projects.set(proj.id, proj);
      this.projectBindings.set(proj.id, new Set());
    });
  }

  /**
   * Retrieves all registered projects.
   * Time Complexity: O(P) where P is the number of projects.
   * Space Complexity: O(P) for array allocation.
   */
  public getProjects(): Project[] {
    return Array.from(this.projects.values());
  }

  /**
   * Creates a new project.
   * Time Complexity: O(1)
   * Space Complexity: O(1)
   */
  public createProject(project: Project): void {
    if (this.projects.has(project.id)) {
      throw new Error(`Project with ID ${project.id} already exists.`);
    }
    this.projects.set(project.id, project);
    this.projectBindings.set(project.id, new Set());
  }

  /**
   * Manually binds an email to a project.
   * Time Complexity: O(1)
   * Space Complexity: O(1) (average hash table entry)
   */
  public bindEmail(emailId: string, projectId: string): void {
    if (!this.projects.has(projectId)) {
      throw new Error(`Project ${projectId} not found.`);
    }

    // Add to project-to-email mapping
    let emails = this.projectBindings.get(projectId);
    if (!emails) {
      emails = new Set();
      this.projectBindings.set(projectId, emails);
    }
    emails.add(emailId);

    // Add to email-to-project mapping
    let projects = this.emailBindings.get(emailId);
    if (!projects) {
      projects = new Set();
      this.emailBindings.set(emailId, projects);
    }
    projects.add(projectId);
  }

  /**
   * Unbinds an email from a project.
   * Time Complexity: O(1)
   * Space Complexity: O(1)
   */
  public unbindEmail(emailId: string, projectId: string): void {
    this.projectBindings.get(projectId)?.delete(emailId);
    this.emailBindings.get(emailId)?.delete(projectId);
  }

  /**
   * Retrieves all email IDs bound to a specific project.
   * Time Complexity: O(K) where K is the number of bound emails.
   */
  public getEmailsForProject(projectId: string): string[] {
    const bound = this.projectBindings.get(projectId);
    return bound ? Array.from(bound) : [];
  }

  /**
   * Retrieves all project IDs associated with a specific email.
   * Time Complexity: O(T) where T is the number of projects the email belongs to.
   */
  public getProjectsForEmail(emailId: string): string[] {
    const bound = this.emailBindings.get(emailId);
    return bound ? Array.from(bound) : [];
  }

  /**
   * Evaluates auto-binding rules across an array of emails.
   * Optimizes performance by pre-indexing rule patterns.
   *
   * Time Complexity: O(N * (P_set + P_regex * R_avg))
   *   - Address matching runs in O(1) via fast set lookup.
   *   - Text/Regex matches are limited only to active rules.
   * Space Complexity: O(P * R) to compile indices and sets.
   */
  public autoBindEmails(emails: Email[]): ProjectMailBinding[] {
    const newBindings: ProjectMailBinding[] = [];

    // 1. Build indices for fast O(1) lookups
    const senderToProjectMap = new Map<string, Set<string>>(); // lowercase address -> Set of projectIds
    const stellarAddressToProjectMap = new Map<string, Set<string>>(); // G-address -> Set of projectIds
    const activeRegexRules: Array<{ projectId: string; rule: AutoBindingRule; compiled: RegExp }> =
      [];

    for (const project of this.projects.values()) {
      // Index stellarAddress associated with project
      if (project.stellarAddress) {
        const addr = project.stellarAddress.toUpperCase();
        let set = stellarAddressToProjectMap.get(addr);
        if (!set) {
          set = new Set();
          stellarAddressToProjectMap.set(addr, set);
        }
        set.add(project.id);
      }

      for (const rule of project.rules) {
        if (!rule.isActive) continue;

        if (rule.type === "sender") {
          const normPattern = rule.pattern.toLowerCase();
          let set = senderToProjectMap.get(normPattern);
          if (!set) {
            set = new Set();
            senderToProjectMap.set(normPattern, set);
          }
          set.add(project.id);
        } else if (rule.type === "subject" || rule.type === "body") {
          try {
            activeRegexRules.push({
              projectId: project.id,
              rule,
              compiled: new RegExp(rule.pattern, "i"),
            });
          } catch (e) {
            // Gracefully ignore invalid regexes in isolated sandbox
          }
        }
      }
    }

    // 2. Iterate through emails and match rules
    for (const email of emails) {
      const emailId = email.id;
      const matchedProjectIds = new Set<string>();

      // A. Exact Sender Matching: O(1) lookup
      const sender = email.email.toLowerCase();
      const directMatches = senderToProjectMap.get(sender);
      if (directMatches) {
        directMatches.forEach((pid) => matchedProjectIds.add(pid));
      }

      // Check wildcards like *@domain.com or name*domain.com (Stellar federation format)
      if (sender.includes("*")) {
        const parts = sender.split("*");
        if (parts.length === 2) {
          const domainPattern = `*@${parts[1]}`;
          const domainMatches = senderToProjectMap.get(domainPattern);
          if (domainMatches) {
            domainMatches.forEach((pid) => matchedProjectIds.add(pid));
          }
        }
      }

      // B. Stellar Escrow/Project Wallet association: O(1) lookup
      // In a real integration, the system verifies email.from or custom headers against G-addresses
      const fromUpper = email.from.toUpperCase();
      const stellarMatches = stellarAddressToProjectMap.get(fromUpper);
      if (stellarMatches) {
        stellarMatches.forEach((pid) => matchedProjectIds.add(pid));
      }

      // C. Regex Matching (Subject & Body)
      for (const { projectId, rule, compiled } of activeRegexRules) {
        if (matchedProjectIds.has(projectId)) continue;

        if (rule.type === "subject" && compiled.test(email.subject)) {
          matchedProjectIds.add(projectId);
        } else if (rule.type === "body" && compiled.test(email.body)) {
          matchedProjectIds.add(projectId);
        }
      }

      // 3. Create bindings
      matchedProjectIds.forEach((pid) => {
        this.bindEmail(emailId, pid);
        newBindings.push({
          projectId: pid,
          emailId,
          boundAt: new Date().toISOString(),
          boundBy: "system-autobinder",
          bindingType: "automatic",
        });
      });
    }

    return newBindings;
  }
}
