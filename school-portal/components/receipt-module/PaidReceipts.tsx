// components/PaidReceipts.tsx
// ================ COMPONENT STARTS HERE ================

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { receiptApi } from '@/lib/receiptApi'
import { Card, CardContent, Button, Select, Input } from '@/components/receipt-module/ui'
import { Spinner } from '@/components/ui'
import { RefreshCw, Users } from 'lucide-react'
const gradeOptions = ['Angel', 'Rainbow', 'Glorious Star', 'Bright Star', 'Lavender', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6', 'Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12']

interface BalancePayment {
  id: string
  itemId: string
  itemName: string
  amount: string
  description: string
  date: string
}

interface Receipt {
  id: number
  receipt_number: string
  date: string
  student_name: string
  grade: string
  term: string
  admission_number: string
  parent_name: string
  total_amount: number
  balance_total: number
  fee_items: Array<{
    id: string
    description: string
    amount: string
  }>
  balance_payments: BalancePayment[] | null
  created_at: string
}


const NAIRA_SYMBOL = '\u20A6'

const formatCurrency = (value?: number | string): string => {
  const amount =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? parseFloat(value.replace(/[^0-9.-]/g, '')) || 0
        : 0
  return `${NAIRA_SYMBOL}${amount.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

const formatDate = (value?: string): string => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  })
}

const PaidReceipts = () => {
  const router = useRouter()
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [selectedGrade, setSelectedGrade] = useState<string>('')

  const goToOutstanding = () => {
    router.push('/finance/outstanding')
  }

  const fetchReceipts = useCallback(async () => {
    setError('')
    setRefreshing(true)

    try {
      const data = await receiptApi.list()

      const filteredReceipts = (data || []).filter(receipt => {
        const payments = Array.isArray(receipt.balance_payments)
          ? receipt.balance_payments
          : []

        const hasBalanceEntries = payments.length > 0
        const balanceTotal =
          typeof receipt.balance_total === 'number'
            ? receipt.balance_total
            : parseFloat(`${receipt.balance_total}`) || 0

        return !hasBalanceEntries && balanceTotal <= 0
      })

      setReceipts(filteredReceipts as Receipt[])
    } catch (err: unknown) {
      console.error('Failed to load paid receipts:', err)
      setError('Unable to load paid receipts right now. Please try again.')
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchReceipts()
  }, [fetchReceipts])

  const filteredReceipts = useMemo(() => {
    if (!selectedGrade) return receipts
    const normalized = selectedGrade.toLowerCase()
    return receipts.filter(receipt =>
      (receipt.grade || '').toLowerCase().includes(normalized)
    )
  }, [receipts, selectedGrade])

  const totalAmount = useMemo(
    () =>
      filteredReceipts.reduce((sum, receipt) => {
        const amount =
          typeof receipt.total_amount === 'number'
            ? receipt.total_amount
            : parseFloat(`${receipt.total_amount}`) || 0
        return sum + amount
      }, 0),
    [filteredReceipts]
  )

  const hasReceipts = receipts.length > 0
  const hasFilteredReceipts = filteredReceipts.length > 0
  const gradeLabel = selectedGrade || 'selected grade'

  if (loading) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-surface'>
        <Spinner className='h-8 w-8 text-brand-600' />
      </div>
    )
  }

  return (
    <div>
      <div className='rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <h1 className='text-2xl font-bold text-gray-800'>Paid Receipts</h1>
            <p className='mt-1 text-sm text-gray-500'>
              All receipts that have been fully settled—no outstanding balance entries remain.
            </p>
          </div>
          <div className='grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto'>
            <Button
              variant='outline'
              className='w-full border-green-200 text-green-700 hover:bg-green-50 sm:w-auto'
              onClick={goToOutstanding}
            >
              <Users className='h-4 w-4' />
              Outstanding Balances
            </Button>
            <Button
              variant='outline'
              className='w-full border-green-200 text-green-700 hover:bg-green-50 sm:w-auto'
              onClick={fetchReceipts}
              disabled={refreshing}
            >
              <RefreshCw className='w-4 h-4' />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
    </div>
      </div>

      <div className='mt-6 grid gap-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-[130px_minmax(0,1fr)] sm:items-center sm:p-5'>
        <label className='whitespace-nowrap text-sm font-medium text-gray-700' htmlFor='grade-filter'>
          Filter by grade
        </label>
        <Select
          id='grade-filter'
          value={selectedGrade}
          onChange={event => setSelectedGrade(event.target.value)}
          className='w-full'
        >
          <option value=''>All grades</option>
          {gradeOptions.map(grade => (
            <option key={grade} value={grade}>
              {grade}
            </option>
          ))}
        </Select>
      </div>

      <div className='mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3'>
        <Card className='bg-green-50 border-green-200'>
          <CardContent className='p-6'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-green-600 mb-1'>Displayed Receipts</p>
                <p className='text-3xl font-bold text-green-700'>{filteredReceipts.length}</p>
              </div>
              <Users className='w-12 h-12 text-green-400' />
            </div>
          </CardContent>
        </Card>
        <Card className='bg-green-50 border-green-200'>
          <CardContent className='p-6'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-green-600 mb-1'>Total Amount</p>
                <p className='text-3xl font-bold text-green-700'>{formatCurrency(totalAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className='bg-green-50 border-green-200'>
          <CardContent className='p-6'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-green-600 mb-1'>Last updated</p>
                <p className='text-sm text-green-700'>
                  {new Date().toLocaleString('en-NG', {
                    hour: '2-digit',
                    minute: '2-digit',
                    month: 'short',
                    day: '2-digit'
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className='mt-6 border border-gray-100 bg-white shadow-sm'>
        <CardContent>
          {error && <p className='text-sm text-red-600 mb-4'>{error}</p>}

          {!hasReceipts ? (
            <p className='text-sm text-gray-600'>
              There are no paid receipts at the moment.
            </p>
          ) : !hasFilteredReceipts ? (
            <p className='text-sm text-gray-600'>
              No paid receipts found for {gradeLabel}.
            </p>
          ) : (
            <div className='overflow-x-auto'>
              <table className='w-full text-left text-sm text-gray-600'>
                <thead className='text-xs uppercase text-gray-500'>
                  <tr>
                    <th className='px-3 py-2'>Receipt #</th>
                    <th className='px-3 py-2'>Student</th>
                    <th className='px-3 py-2'>Grade</th>
                    <th className='px-3 py-2'>Term</th>
                    <th className='px-3 py-2 text-right'>Total</th>
                    <th className='px-3 py-2'>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReceipts.map(receipt => (
                    <tr
                      key={receipt.id}
                      className='border-t border-gray-100 hover:bg-gray-50'
                    >
                      <td className='px-3 py-2 font-medium text-gray-800'>
                        {receipt.receipt_number}
                      </td>
                      <td className='px-3 py-2'>{receipt.student_name || '-'}</td>
                      <td className='px-3 py-2'>{receipt.grade || '-'}</td>
                      <td className='px-3 py-2'>{receipt.term || '-'}</td>
                      <td className='px-3 py-2 text-right text-green-600 font-semibold'>
                        {formatCurrency(receipt.total_amount)}
                      </td>
                      <td className='px-3 py-2'>{formatDate(receipt.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  </div>
)
}

export default PaidReceipts

// ================ COMPONENT ENDS HERE ================
