import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { BICUBIC2, createICNS, createICO } from 'png2icons'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')
const LOGO_SVG = path.join(ROOT_DIR, 'resources/logo.svg')
const BUILD_DIR = path.join(ROOT_DIR, 'build')
const RESOURCES_DIR = path.join(ROOT_DIR, 'resources')

const ICON_PNG_SIZE = 512
// icns/ico embed multiple sizes up to 1024/256; render from a large master
// so every embedded size is downscaled, never upscaled.
const ICON_MASTER_SIZE = 1024

async function renderPng(size: number): Promise<Buffer> {
  return sharp(LOGO_SVG).resize(size, size).png().toBuffer()
}

async function main(): Promise<void> {
  await mkdir(BUILD_DIR, { recursive: true })
  await mkdir(RESOURCES_DIR, { recursive: true })

  const icon = await renderPng(ICON_PNG_SIZE)
  await writeFile(path.join(RESOURCES_DIR, 'icon.png'), icon)
  await writeFile(path.join(BUILD_DIR, 'icon.png'), icon)

  const master = await renderPng(ICON_MASTER_SIZE)

  const icns = createICNS(master, BICUBIC2, 0)
  if (!icns) throw new Error('failed to generate build/icon.icns')
  await writeFile(path.join(BUILD_DIR, 'icon.icns'), icns)

  // forWinExe: store as PNG above 64px and BMP below, matching what
  // electron-builder embeds into the Windows executable.
  const ico = createICO(master, BICUBIC2, 0, true, true)
  if (!ico) throw new Error('failed to generate build/icon.ico')
  await writeFile(path.join(BUILD_DIR, 'icon.ico'), ico)

  console.log(
    'Regenerated build/icon.png, build/icon.ico, build/icon.icns, resources/icon.png from resources/logo.svg.'
  )
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
