import { Octokit } from "@octokit/rest";
export function createOctokitClient(authToken) {
    return new Octokit({ auth: authToken });
}
//# sourceMappingURL=github.js.map