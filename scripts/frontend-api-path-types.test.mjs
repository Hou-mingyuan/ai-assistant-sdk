import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const typeProbe = String.raw`
import type {
  ExportRequestPayload,
  FileUploadResponse,
  PromptTemplatesResponse,
  RuntimeDiscoverModelsResult,
} from '../../ai-assistant-ui/src/utils/api'
import type { paths } from '../../ai-assistant-ui/src/types/api-generated'

type ApiPaths = paths
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false
type Assert<T extends true> = T
type JsonResponse<
  Path extends keyof ApiPaths,
  Method extends keyof ApiPaths[Path],
> = NonNullable<ApiPaths[Path][Method]> extends {
  responses: { 200: { content: { 'application/json': infer Response } } }
}
  ? Response
  : never
type JsonRequestBody<
  Path extends keyof ApiPaths,
  Method extends keyof ApiPaths[Path],
> = NonNullable<ApiPaths[Path][Method]> extends {
  requestBody: { content: { 'application/json': infer Request } }
}
  ? Request
  : never

type _ExportRequestUsesPathType = Assert<
  Equal<ExportRequestPayload, JsonRequestBody<'/export', 'post'>>
>
type _FileUploadUsesPathResponse = Assert<
  Equal<FileUploadResponse, JsonResponse<'/file/summarize', 'post'>>
>
type _PromptTemplatesUsePathResponse = Assert<
  Equal<PromptTemplatesResponse, JsonResponse<'/templates', 'get'>>
>
type _RuntimeDiscoveryUsesPathResponse = Assert<
  Equal<RuntimeDiscoverModelsResult, JsonResponse<'/admin/runtime/model-config/discover-models', 'post'>>
>
`

test('frontend API helper types are derived from generated OpenAPI paths', async () => {
  const parent = join(process.cwd(), '.openapi-tmp')
  await mkdir(parent, { recursive: true })
  const dir = await mkdtemp(join(parent, 'api-path-types-'))
  const probePath = join(dir, 'probe.ts')
  await writeFile(probePath, typeProbe, 'utf8')
  try {
    const result = spawnSync(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      [
        'exec',
        '--prefix',
        'ai-assistant-ui',
        '--',
        'tsc',
        '--noEmit',
        '--strict',
        '--skipLibCheck',
        '--target',
        'ES2021',
        '--module',
        'ESNext',
        '--moduleResolution',
        'bundler',
        '--lib',
        'ES2021,DOM,DOM.Iterable',
        probePath,
      ],
      { cwd: process.cwd(), encoding: 'utf8', shell: process.platform === 'win32' },
    )

    assert.equal(result.status, 0, result.error?.message ?? result.stdout + result.stderr)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
