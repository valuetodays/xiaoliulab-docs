const DEPLOYMENTS_URL = 'https://api.github.com/repos/valuetodays/xiaoliulab-docs/deployments';

interface Deployment {
  id: number;
}

interface DeploymentStatus {
  state: string;
  created_at: string;
}

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: 'application/vnd.github+json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(`GitHub deployment request failed: ${response.status}`);
  }

  return response.json();
}

/** 读取 GitHub 记录的成功状态时间；失败或进行中的部署不改变发布时间。 */
export async function getLatestPublicationTime(signal: AbortSignal): Promise<string | null> {
  const deployments = await getJson<Deployment[]>(
    `${DEPLOYMENTS_URL}?environment=github-pages&per_page=10`,
    signal,
  );

  for (const deployment of deployments) {
    const statuses = await getJson<DeploymentStatus[]>(
      `${DEPLOYMENTS_URL}/${deployment.id}/statuses?per_page=100`,
      signal,
    );
    const success = statuses.find(({ state }) => state === 'success');

    if (success && Number.isFinite(Date.parse(success.created_at))) {
      return success.created_at;
    }
  }

  return null;
}
