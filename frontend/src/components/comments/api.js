import { api } from '../../services/http'

export async function fetchComments(targetType, targetId) {
  const { data } = await api.get(`/comments/${targetType}/${targetId}`)
  return data
}

export async function createComment(targetType, targetId, contenido) {
  const { data } = await api.post(`/comments/${targetType}/${targetId}`, {
    contenido,
  })
  return data.item
}

export async function updateComment(commentId, contenido) {
  const { data } = await api.patch(`/comments/${commentId}`, { contenido })
  return data.item
}

export async function deleteComment(commentId) {
  await api.delete(`/comments/${commentId}`)
}
