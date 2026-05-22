import { useEffect, useMemo, useRef, useState } from 'react'

function appendUniqueItems(currentItems, nextItems) {
  if (!nextItems?.length) {
    return currentItems
  }

  const seen = new Set(currentItems.map((item) => item.id))
  const appended = [...currentItems]

  nextItems.forEach((item) => {
    if (seen.has(item.id)) {
      return
    }

    seen.add(item.id)
    appended.push(item)
  })

  return appended
}

export function useIncrementalCardFeed({
  seedKey,
  initialItems,
  initialTotal,
  initialNextCursor,
  pageSize = 10,
  initialShownCount = pageSize,
  fetchPage,
}) {
  const [items, setItems] = useState(() => initialItems || [])
  const [total, setTotal] = useState(initialTotal || 0)
  const [nextCursor, setNextCursor] = useState(initialNextCursor || null)
  const [requestedCount, setRequestedCount] = useState(initialShownCount)
  const [isFetchingMore, setIsFetchingMore] = useState(false)
  const [error, setError] = useState('')

  const itemsRef = useRef(items)
  const nextCursorRef = useRef(nextCursor)
  const totalRef = useRef(total)
  const requestedCountRef = useRef(requestedCount)
  const isFetchingMoreRef = useRef(isFetchingMore)
  const initialItemsRef = useRef(initialItems || [])

  initialItemsRef.current = initialItems || []

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => {
    nextCursorRef.current = nextCursor
  }, [nextCursor])

  useEffect(() => {
    totalRef.current = total
  }, [total])

  useEffect(() => {
    requestedCountRef.current = requestedCount
  }, [requestedCount])

  useEffect(() => {
    isFetchingMoreRef.current = isFetchingMore
  }, [isFetchingMore])

  useEffect(() => {
    setItems(initialItemsRef.current)
    setTotal(initialTotal || 0)
    setNextCursor(initialNextCursor || null)
    setRequestedCount(initialShownCount)
    setError('')
  }, [initialNextCursor, initialShownCount, initialTotal, seedKey])

  async function fetchUntilTarget(targetCount, loadAll = false) {
    if (isFetchingMoreRef.current || !nextCursorRef.current) {
      return
    }

    setIsFetchingMore(true)
    setError('')

    try {
      while (nextCursorRef.current) {
        const remainingCount = Math.max(
          pageSize,
          targetCount - itemsRef.current.length
        )
        const requestedLimit = loadAll
          ? Math.min(Math.max(remainingCount, pageSize * 3), 100)
          : Math.min(remainingCount, 100)

        const response = await fetchPage({
          limit: requestedLimit,
          cursor: nextCursorRef.current,
        })

        const responseItems = response?.items || []
        const responseMeta = response?.meta || {}
        const nextItems = appendUniqueItems(itemsRef.current, responseItems)
        const nextTotal =
          responseMeta.total ?? responseMeta.totalVisible ?? totalRef.current
        const nextPageCursor = responseMeta.nextCursor || null

        itemsRef.current = nextItems
        totalRef.current = nextTotal
        nextCursorRef.current = nextPageCursor

        setItems(nextItems)
        setTotal(nextTotal)
        setNextCursor(nextPageCursor)

        if (!loadAll && nextItems.length >= targetCount) {
          break
        }

        if (!nextPageCursor) {
          break
        }
      }
    } catch (fetchError) {
      setError(
        fetchError?.response?.data?.message ||
          fetchError?.message ||
          'No se pudieron cargar mas elementos.'
      )
    } finally {
      setIsFetchingMore(false)
    }
  }

  async function handleLoadMore() {
    const nextTarget = requestedCountRef.current + pageSize
    setRequestedCount(nextTarget)

    if (itemsRef.current.length < nextTarget && nextCursorRef.current) {
      await fetchUntilTarget(nextTarget, false)
    }
  }

  function handleLoadLess() {
    setRequestedCount((current) =>
      Math.max(current - pageSize, initialShownCount)
    )
  }

  async function handleLoadAll() {
    const target = Math.max(totalRef.current, itemsRef.current.length)
    setRequestedCount(target)

    if (nextCursorRef.current) {
      await fetchUntilTarget(target, true)
    }
  }

  function handleShowRecent() {
    setRequestedCount(initialShownCount)
  }

  const visibleCount = Math.min(
    Math.max(requestedCount, initialShownCount),
    items.length || pageSize
  )
  const visibleItems = useMemo(
    () => items.slice(0, visibleCount),
    [items, visibleCount]
  )

  return {
    items: visibleItems,
    total,
    shownCount: visibleItems.length,
    canLoadMore: Boolean(nextCursor) || items.length > requestedCount,
    canLoadLess: requestedCount > initialShownCount,
    isFetchingMore,
    error,
    loadMore: handleLoadMore,
    loadLess: handleLoadLess,
    loadAll: handleLoadAll,
    showRecent: handleShowRecent,
  }
}
