declare module '#auth-utils' {
  interface User {
    id: string
    email: string | null
    username: string | null
  }
}

export {}
