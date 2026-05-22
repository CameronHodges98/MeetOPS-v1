import { useQuery } from '@tanstack/react-query'
import type { UphApiRow } from './utils'

export function useUphData(dateFrom: string, dateTo: string, jobTitle?: string | null) {
  return useQuery<UphApiRow[]>({
    queryKey: ['uph', dateFrom, dateTo, jobTitle],
    queryFn: async () => {
      const params = new URLSearchParams({ from: dateFrom, to: dateTo })
      if (jobTitle) params.set('jobTitle', jobTitle)
      const res = await fetch(`/api/uph?${params}`)
      if (!res.ok) throw new Error('Failed to fetch UPH data')
      return res.json()
    },
    staleTime: 60_000,
    enabled: Boolean(dateFrom && dateTo),
  })
}
