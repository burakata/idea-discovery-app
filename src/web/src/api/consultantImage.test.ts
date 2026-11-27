import { describe, expect, it } from 'vitest'
import { consultant as c } from '../strings/consultant'
import { ApiError, consultantErrorKey, createApiClient } from './client'
import { createConsultantApi, IMAGE_MAX_BYTES, toProject } from './consultant'

interface Call {
  method: string
  url: string
  headers: Record<string, string>
  body: unknown
}

// A fake server: answers are taken in order; the CSRF call is answered by itself.
function setup(answers: Array<Response | Error>) {
  const calls: Call[] = []
  let csrfCalls = 0
  const send = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === '/api/auth/csrf') {
      csrfCalls += 1
      return json({ token: `T${csrfCalls}` })
    }
    calls.push({
      method: init?.method ?? 'GET',
      url: String(input),
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body,
    })
    const answer = answers.shift()
    if (!answer) throw new Error('no answer left')
    if (answer instanceof Error) throw answer
    return answer
  }) as typeof fetch
  const api = createApiClient({ fetch: send })
  return { consultant: createConsultantApi(api), calls }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const png = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'photo.png', { type: 'image/png' })

describe('uploading a project image', () => {
  it('sends the file as multipart in the field "file", with the CSRF token and no JSON type, and returns the version', async () => {
    const { consultant, calls } = setup([json({ imageVersion: 'v7' })])

    expect(await consultant.uploadImage('p 1', png())).toBe('v7')

    const [call] = calls
    expect(call.method).toBe('POST')
    expect(call.url).toBe('/api/consultant/projects/p%201/image')
    expect(call.headers['X-CSRF-TOKEN']).toBe('T1')
    // The browser must set the multipart Content-Type itself, with its boundary.
    expect(call.headers['Content-Type']).toBeUndefined()
    expect(call.body).toBeInstanceOf(FormData)
    const sent = (call.body as FormData).get('file')
    expect(sent).toBeInstanceOf(File)
    expect((sent as File).name).toBe('photo.png')
  })

  it('asks for a new CSRF token once when the first is refused, and sends the same file again', async () => {
    const { consultant, calls } = setup([json({ error: 'request_refused' }, 403), json({ imageVersion: 'v2' })])

    expect(await consultant.uploadImage('p1', png())).toBe('v2')

    expect(calls.map((call) => call.headers['X-CSRF-TOKEN'])).toEqual(['T1', 'T2'])
    expect((calls[1].body as FormData).get('file')).toBeInstanceOf(File)
  })

  it('refuses a file over the limit without sending it', async () => {
    const { consultant, calls } = setup([])
    const big = new File([new Uint8Array(IMAGE_MAX_BYTES + 1)], 'big.png', { type: 'image/png' })

    await expect(consultant.uploadImage('p1', big)).rejects.toMatchObject({ status: 413 })
    expect(calls).toHaveLength(0)
  })

  it('refuses an answer without a version', async () => {
    const { consultant } = setup([json({})])
    await expect(consultant.uploadImage('p1', png())).rejects.toBeInstanceOf(ApiError)
  })

  it('maps the refusals to texts Burak can read', () => {
    expect(consultantErrorKey(400, 'image_not_valid')).toBe('imageNotValid')
    expect(consultantErrorKey(413, null)).toBe('imageTooLarge')
    expect(c.errors.imageNotValid).toBeTruthy()
    expect(c.errors.imageTooLarge).toBeTruthy()
  })

  it('throws the API error with that key for a refused file', async () => {
    const { consultant } = setup([json({ error: 'image_not_valid' }, 400)])
    const failure = await consultant.uploadImage('p1', png()).catch((error: unknown) => error)
    expect((failure as ApiError).consultantKey).toBe('imageNotValid')
  })
})

describe('removing a project image and showing it', () => {
  it('posts the removal and accepts 204', async () => {
    const { consultant, calls } = setup([new Response(null, { status: 204 })])
    await consultant.removeImage('p1')
    expect(calls[0].url).toBe('/api/consultant/projects/p1/image/remove')
    expect(calls[0].method).toBe('POST')
  })

  it('builds the address from the API base, with the version so a new image is a new address', () => {
    const { consultant } = setup([])
    expect(consultant.imageUrl('p 1', 'v/1')).toBe('/api/projects/p%201/image?v=v%2F1')
  })

  it('reads the version from a project, null when there is none', () => {
    expect(toProject({ id: 'p1', imageVersion: 'v3' }).imageVersion).toBe('v3')
    expect(toProject({ id: 'p1', imageVersion: null }).imageVersion).toBeNull()
    expect(toProject({ id: 'p1' }).imageVersion).toBeNull()
  })
})
