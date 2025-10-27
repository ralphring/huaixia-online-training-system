import React, { useState, useEffect } from 'react'
import { Video, supabase } from '@/lib/supabase'
import { X, Loader } from 'lucide-react'

interface VideoSettingsModalProps {
  video: Video | null
  onClose: () => void
  onSave: () => void
}

export function VideoSettingsModal({ video, onClose, onSave }: VideoSettingsModalProps) {
  const [title, setTitle] = useState('')
  const [password, setPassword] = useState('')
  const [isEnabled, setIsEnabled] = useState(true)
  const [downloadable, setDownloadable] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (video) {
      setTitle(video.title)
      setPassword(video.access_password || '')
      setIsEnabled(video.is_enabled)
      setDownloadable(video.downloadable !== false) // Default to true if undefined
    }
  }, [video])

  if (!video) return null

  async function handleSave() {
    setSaving(true)

    try {
      const { error } = await supabase
        .from('videos')
        .update({
          title,
          access_password: password || null,
          is_enabled: isEnabled,
          downloadable
        })
        .eq('id', video.id)

      if (error) throw error

      onSave()
      onClose()
    } catch (error) {
      alert('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div
        className="bg-white rounded-2xl max-w-lg w-full p-12 shadow-modal animate-in fade-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-neutral-900">视频设置</h2>
          <button
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-neutral-100 transition-colors duration-200"
          >
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-3">
              视频标题
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-12 px-4 bg-white border border-neutral-200 rounded-lg focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all duration-250"
              placeholder="请输入视频标题"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-3">
              访问密码（可选）
            </label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 px-4 bg-white border border-neutral-200 rounded-lg focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all duration-250"
              placeholder="请输入访问密码，不设置则不需密码"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="enabled"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="w-4 h-4 text-primary-500 border-neutral-300 rounded focus:ring-primary-500"
            />
            <label htmlFor="enabled" className="text-sm text-neutral-700 cursor-pointer">
              启用访问控制（停用后分享链接将无法访问）
            </label>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="downloadable"
              checked={downloadable}
              onChange={(e) => setDownloadable(e.target.checked)}
              className="w-4 h-4 text-primary-500 border-neutral-300 rounded focus:ring-primary-500"
            />
            <label htmlFor="downloadable" className="text-sm text-neutral-700 cursor-pointer">
              允许用户下载此视频
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 h-12 px-6 bg-white border border-neutral-200 text-neutral-700 font-semibold rounded-xl hover:bg-neutral-50 transition-all duration-200"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 h-12 px-6 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-700 active:scale-98 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  保存中...
                </>
              ) : (
                '保存'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
