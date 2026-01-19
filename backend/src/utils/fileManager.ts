import { promises as fs } from 'fs'
import { dirname } from 'path'
import { Result } from './Result.js'
import { AppError } from './errors.js'

/**
 * File manager utility for reading/writing JSON files
 */
export class FileManager {
  /**
   * Ensure directory exists
   */
  static async ensureDir(path: string): Promise<Result<void, AppError>> {
    try {
      await fs.mkdir(path, { recursive: true })
      return Result.ok(undefined)
    } catch (error) {
      return Result.err(
        new AppError(
          `Failed to create directory: ${path}`,
          'FILE_ERROR',
          error
        )
      )
    }
  }

  /**
   * Read JSON file
   */
  static async readJson<T>(filePath: string): Promise<Result<T, AppError>> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const data = JSON.parse(content) as T
      return Result.ok(data)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return Result.err(
          new AppError(`File not found: ${filePath}`, 'FILE_NOT_FOUND', error)
        )
      }
      return Result.err(
        new AppError(
          `Failed to read JSON file: ${filePath}`,
          'FILE_ERROR',
          error
        )
      )
    }
  }

  /**
   * Write JSON file (creates directory if needed)
   */
  static async writeJson<T>(
    filePath: string,
    data: T
  ): Promise<Result<void, AppError>> {
    try {
      // Ensure directory exists
      const dir = dirname(filePath)
      const dirResult = await this.ensureDir(dir)
      if (dirResult.isErr()) {
        return dirResult
      }

      // Write file
      const content = JSON.stringify(data, null, 2)
      await fs.writeFile(filePath, content, 'utf-8')
      return Result.ok(undefined)
    } catch (error) {
      return Result.err(
        new AppError(
          `Failed to write JSON file: ${filePath}`,
          'FILE_ERROR',
          error
        )
      )
    }
  }

  /**
   * Check if file exists
   */
  static async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }
}
