const HF_API = "https://huggingface.co/api/models";

export interface HubModel {
  id: string;
  downloads: number;
}

export interface HubFile {
  name: string;
  size: number;
}

export async function searchModels(
  query: string,
  filterByTag = true,
  tag = "gguf",
): Promise<HubModel[]> {
  const params = new URLSearchParams({
    search: query,
    sort: "downloads",
    direction: "-1",
    limit: "15",
  });
  if (filterByTag && tag) params.set("filter", tag);

  const res = await fetch(`${HF_API}?${params}`);
  if (!res.ok) throw new Error(`HF API: ${res.status}`);
  const data = (await res.json()) as any[];

  return data.map((m) => ({
    id: m.modelId ?? m._id,
    downloads: m.downloads ?? 0,
  }));
}

export async function listModelFiles(repoId: string): Promise<HubFile[]> {
  const res = await fetch(`${HF_API}/${repoId}`);
  if (!res.ok) throw new Error(`HF API: ${res.status}`);
  const data = (await res.json()) as any;

  return (data.siblings ?? [])
    .filter((f: any) => f.rfilename?.endsWith(".gguf"))
    .map((f: any) => ({
      name: f.rfilename as string,
      size: (f.size ?? 0) as number,
    }))
    .sort((a: HubFile, b: HubFile) => a.size - b.size);
}
