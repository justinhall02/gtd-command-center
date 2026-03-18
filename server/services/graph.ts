import { PublicClientApplication, LogLevel } from '@azure/msal-node'
import fs from 'fs'

const TOKEN_CACHE_PATH = process.env.M365_TOKEN_CACHE_PATH || '/home/justin/.m365-mcp/token-cache.json'
const CLIENT_ID = '084a3e9f-a9f4-43f7-89f9-d229cf97853e'
const TENANT_ID = 'a7eca834-65a1-4247-8b9a-d7080726b526'
const USERNAME = 'Justin@JustinHallConsulting.com'

const SCOPES = [
  'Mail.ReadWrite',
  'Mail.Send',
  'Tasks.ReadWrite',
  'User.Read',
]

let msalClient: PublicClientApplication | null = null

async function getMsalClient(): Promise<PublicClientApplication> {
  if (msalClient) return msalClient

  const config = {
    auth: {
      clientId: CLIENT_ID,
      authority: `https://login.microsoftonline.com/${TENANT_ID}`,
    },
    system: {
      loggerOptions: {
        logLevel: LogLevel.Warning,
      },
    },
    cache: {
      cachePlugin: {
        async beforeCacheAccess(context: any) {
          const data = fs.readFileSync(TOKEN_CACHE_PATH, 'utf-8')
          context.tokenCache.deserialize(data)
        },
        async afterCacheAccess(context: any) {
          if (context.cacheHasChanged) {
            fs.writeFileSync(TOKEN_CACHE_PATH, context.tokenCache.serialize())
          }
        },
      },
    },
  }

  msalClient = new PublicClientApplication(config)
  return msalClient
}

export async function getAccessToken(): Promise<string> {
  const client = await getMsalClient()
  const accounts = await client.getTokenCache().getAllAccounts()

  const account = accounts.find(a =>
    a.username?.toLowerCase() === USERNAME.toLowerCase()
  )

  if (!account) {
    throw new Error(`No cached account found for ${USERNAME}. Restart Claude Code to refresh M365 auth.`)
  }

  const result = await client.acquireTokenSilent({
    scopes: SCOPES,
    account,
  })

  if (!result?.accessToken) {
    throw new Error('Failed to acquire token silently. Token may be expired — restart Claude Code.')
  }

  return result.accessToken
}

// Generic Graph API caller
export async function graphCall(endpoint: string, options: RequestInit = {}): Promise<any> {
  const token = await getAccessToken()

  const res = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!res.ok) {
    const errorBody = await res.text()
    throw new Error(`Graph API ${res.status}: ${errorBody}`)
  }

  const contentType = res.headers.get('content-type')
  if (contentType?.includes('application/json')) {
    return res.json()
  }
  return res.text()
}

// Convenience methods
export const graph = {
  async listFolders() {
    const root = await graphCall('/me/mailFolders?$select=id,displayName,unreadItemCount,totalItemCount&$top=50')
    return root.value
  },

  async listChildFolders(folderId: string) {
    const res = await graphCall(`/me/mailFolders/${folderId}/childFolders?$select=id,displayName,unreadItemCount,totalItemCount&$top=50`)
    return res.value
  },

  async listMessages(folderId: string, top = 20, skip = 0) {
    const res = await graphCall(
      `/me/mailFolders/${folderId}/messages?$select=id,subject,from,bodyPreview,receivedDateTime,isRead,hasAttachments&$orderby=receivedDateTime desc&$top=${top}&$skip=${skip}`
    )
    return res.value
  },

  async getMessage(messageId: string) {
    return graphCall(`/me/messages/${messageId}?$select=id,subject,from,toRecipients,body,bodyPreview,receivedDateTime,isRead,hasAttachments`)
  },

  async moveMessage(messageId: string, destinationFolderId: string) {
    return graphCall(`/me/messages/${messageId}/move`, {
      method: 'POST',
      body: JSON.stringify({ DestinationId: destinationFolderId }),
    })
  },

  async listTodoLists() {
    const res = await graphCall('/me/todo/lists?$top=50')
    return res.value
  },

  async listTodoTasks(listId: string) {
    const res = await graphCall(`/me/todo/lists/${listId}/tasks?$filter=status ne 'completed'&$top=50`)
    return res.value
  },

  async createTodoTask(listId: string, task: { title: string; body?: string; importance?: string }) {
    return graphCall(`/me/todo/lists/${listId}/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        title: task.title,
        body: task.body ? { content: task.body, contentType: 'text' } : undefined,
        importance: task.importance || 'normal',
      }),
    })
  },
}
