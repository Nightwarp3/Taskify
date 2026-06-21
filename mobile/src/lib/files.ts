/**
 * File export/import — replaces the Capacitor Filesystem+Share path.
 * Export writes a JSON file to the document directory and opens the native
 * share sheet; import uses the document picker and reads the file back.
 */
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import * as DocumentPicker from 'expo-document-picker'
import type { ExportData } from '@shared/types'

function localDateString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function exportToFile(data: ExportData): Promise<{ ok: boolean }> {
  try {
    const json = JSON.stringify(data, null, 2)
    const uri = `${FileSystem.documentDirectory}taskify-export-${localDateString()}.json`
    await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 })

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/json',
        dialogTitle: 'Save or share your Taskify data',
        UTI: 'public.json'
      })
    }
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

/** Prompt the user to pick a Taskify export file and parse it. */
export async function pickImportFile(): Promise<ExportData | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true
  })
  if (result.canceled || !result.assets?.[0]) return null

  const raw = await FileSystem.readAsStringAsync(result.assets[0].uri, {
    encoding: FileSystem.EncodingType.UTF8
  })
  const data = JSON.parse(raw) as ExportData
  if (data.app !== 'taskify' || !Array.isArray(data.tasks)) {
    throw new Error('Not a valid Taskify export file.')
  }
  return data
}
