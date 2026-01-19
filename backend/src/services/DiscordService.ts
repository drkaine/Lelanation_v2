import axios, { AxiosInstance } from 'axios'
import { Result } from '../utils/Result.js'
import { AppError } from '../utils/errors.js'

interface DiscordWebhookPayload {
  content?: string
  embeds?: Array<{
    title?: string
    description?: string
    color?: number
    fields?: Array<{
      name: string
      value: string
      inline?: boolean
    }>
    timestamp?: string
    footer?: {
      text: string
    }
  }>
}

export class DiscordService {
  private readonly api: AxiosInstance
  private readonly webhookUrl: string | null

  constructor(webhookUrl?: string) {
    this.webhookUrl = webhookUrl || process.env.DISCORD_WEBHOOK_URL || null
    this.api = axios.create({
      timeout: 10000
    })
  }

  /**
   * Send alert to Discord webhook
   */
  async sendAlert(
    title: string,
    message: string,
    error?: unknown,
    context?: Record<string, unknown>
  ): Promise<Result<void, AppError>> {
    if (!this.webhookUrl) {
      // If no webhook URL, log to console instead
      console.warn('[DiscordService] No webhook URL configured. Alert:', {
        title,
        message,
        error,
        context
      })
      return Result.ok(undefined)
    }

    try {
      const embed: DiscordWebhookPayload['embeds'] = [
        {
          title,
          description: message,
          color: 0xff0000, // Red color for errors
          timestamp: new Date().toISOString(),
          fields: []
        }
      ]

      if (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        embed[0].fields?.push({
          name: 'Error',
          value: errorMessage.substring(0, 1024), // Discord limit
          inline: false
        })
      }

      if (context) {
        for (const [key, value] of Object.entries(context)) {
          embed[0].fields?.push({
            name: key,
            value: String(value).substring(0, 1024),
            inline: true
          })
        }
      }

      embed[0].footer = {
        text: 'Lelanation Backend'
      }

      const payload: DiscordWebhookPayload = {
        embeds: embed
      }

      await this.api.post(this.webhookUrl, payload)

      return Result.ok(undefined)
    } catch (error) {
      // Don't fail the main operation if Discord alert fails
      console.error('[DiscordService] Failed to send alert:', error)
      return Result.err(
        new AppError(
          'Failed to send Discord alert',
          'DISCORD_ERROR',
          error
        )
      )
    }
  }

  /**
   * Send success notification (optional, for important operations)
   */
  async sendSuccess(
    title: string,
    message: string,
    context?: Record<string, unknown>
  ): Promise<Result<void, AppError>> {
    if (!this.webhookUrl) {
      return Result.ok(undefined)
    }

    try {
      const embed: DiscordWebhookPayload['embeds'] = [
        {
          title,
          description: message,
          color: 0x00ff00, // Green color for success
          timestamp: new Date().toISOString(),
          fields: []
        }
      ]

      if (context) {
        for (const [key, value] of Object.entries(context)) {
          embed[0].fields?.push({
            name: key,
            value: String(value).substring(0, 1024),
            inline: true
          })
        }
      }

      embed[0].footer = {
        text: 'Lelanation Backend'
      }

      const payload: DiscordWebhookPayload = {
        embeds: embed
      }

      await this.api.post(this.webhookUrl, payload)

      return Result.ok(undefined)
    } catch (error) {
      console.error('[DiscordService] Failed to send success notification:', error)
      return Result.err(
        new AppError(
          'Failed to send Discord notification',
          'DISCORD_ERROR',
          error
        )
      )
    }
  }
}
