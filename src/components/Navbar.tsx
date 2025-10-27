import React from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { LogOut } from 'lucide-react'

export function Navbar() {
  const { user, signOut } = useAuth()

  async function handleSignOut() {
    await signOut()
    window.location.href = '/'
  }

  return (
    <nav className="sticky top-0 h-16 bg-white border-b border-neutral-100 px-12 flex items-center justify-between z-10">
      <div className="flex items-center gap-3">
        <img src="/logo.png" alt="华夏在线" className="h-10" />
        <h1 className="text-xl font-semibold text-neutral-900">
          线上培训系统
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-primary-700">
              {user?.email?.[0].toUpperCase()}
            </span>
          </div>
          <span className="text-base text-neutral-700 hidden sm:inline">
            {user?.email}
          </span>
        </div>
        <button
          onClick={handleSignOut}
          className="h-10 px-4 bg-white border border-neutral-200 text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-50 hover:border-primary-500 transition-all duration-200 flex items-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          退出
        </button>
      </div>
    </nav>
  )
}
