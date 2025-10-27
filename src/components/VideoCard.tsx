import React, { useState } from 'react'
import { Video } from '@/lib/supabase'
import { Copy, Settings, Trash2, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface VideoCardProps {
  video: Video
  onDelete: () => void
  onEdit: (video: Video) => void
}

export function VideoCard({ video, onDelete, onEdit }: VideoCardProps) {
  const [copied, setCopied] = useState(false)
  const [isEnabled, setIsEnabled] = useState(video.is_enabled)
  const shareLink = `${window.location.origin}/watch/${video.id}`

  async function handleCopy() {
    await navigator.clipboard.writeText(shareLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleToggleEnabled() {
    const newValue = !isEnabled
    setIsEnabled(newValue)

    const { error } = await supabase
      .from('videos')
      .update({ is_enabled: newValue })
      .eq('id', video.id)

    if (error) {
      setIsEnabled(!newValue)
      alert('更新失败，请重试')
    }
  }

  async function handleDelete() {
    if (!confirm('确定要删除这个视频吗？')) return

    // Delete from storage
    await supabase.storage.from('videos').remove([video.file_path])

    // Delete from database
    const { error } = await supabase.from('videos').delete().eq('id', video.id)

    if (error) {
      alert('删除失败，请重试')
    } else {
      onDelete()
    }
  }

  return (
    <div className="bg-white rounded-xl p-8 border border-neutral-100 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300">
      <div className="aspect-video bg-neutral-100 rounded-lg mb-4 flex items-center justify-center">
        <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
          </svg>
        </div>
      </div>

      <h3 className="text-lg font-medium text-neutral-900 mb-2 truncate" title={video.title}>
        {video.title}
      </h3>

      <p className="text-sm text-neutral-400 mb-4">
        {new Date(video.created_at).toLocaleString('zh-CN')}
      </p>

      <div className="flex items-center gap-2 mb-4">
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            isEnabled
              ? 'bg-success-100 text-success-700'
              : 'bg-neutral-100 text-neutral-700'
          }`}
        >
          {isEnabled ? '已启用' : '已停用'}
        </span>
        {video.access_password && (
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
            密码保护
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 mb-4">
        <input
          type="text"
          value={shareLink}
          readOnly
          className="flex-1 h-10 px-3 bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-700"
        />
        <button
          onClick={handleCopy}
          className="h-10 w-10 flex items-center justify-center bg-primary-500 text-white rounded-lg hover:bg-primary-700 transition-all duration-200"
          title="复制链接"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={handleToggleEnabled}
            className="w-4 h-4 text-primary-500 border-neutral-300 rounded focus:ring-primary-500"
          />
          <span className="text-sm text-neutral-700">启用访问</span>
        </label>
        <div className="flex-1"></div>
        <button
          onClick={() => onEdit(video)}
          className="h-9 px-3 flex items-center gap-2 bg-white border border-neutral-200 text-neutral-700 text-sm rounded-lg hover:bg-neutral-50 hover:border-primary-500 transition-all duration-200"
        >
          <Settings className="w-4 h-4" />
          设置
        </button>
        <button
          onClick={handleDelete}
          className="h-9 px-3 flex items-center gap-2 bg-white border border-neutral-200 text-error-500 text-sm rounded-lg hover:bg-error-50 hover:border-error-500 transition-all duration-200"
        >
          <Trash2 className="w-4 h-4" />
          删除
        </button>
      </div>
    </div>
  )
}
