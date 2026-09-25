declare module '#auth-utils' {
  interface User {
    id: string
    email: string | null
    username: string | null
    displayName: string
    role: 'owner' | 'member'
    locale?: string | null
  }
}

export {}
