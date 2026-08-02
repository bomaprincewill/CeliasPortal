// components/fee-breakdown.tsx
// ================ COMPONENT STARTS HERE ================

import React, { useMemo, useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Input, Button, Select } from '@/components/receipt-module/ui'
const Logo = '/celias-logo.png'
import Image from 'next/image'
import Link from 'next/link'
import html2canvas from 'html2canvas-pro'
import jsPDF from 'jspdf'
import { receiptApi } from '@/lib/receiptApi'
import { 
  Search, 
  X, 
  FileText, 
  Download, 
  Calendar, 
  User, 
  Hash, 
  CreditCard, 
  Eye, 
  Trash2, 
  AlertTriangle, 
  RotateCcw, 
  PlusCircle, 
  MinusCircle, 
  Edit, 
  Save,
  Users,
  BarChart3
} from 'lucide-react'

// ================ TYPES AND INTERFACES ================

interface BalancePayment {
  id: string
  itemId: string
  itemName: string
  amount: string
  description: string
  date: string
}

interface FeeItem {
  id: string
  description: string
  amount: string | null
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
  fee_items: FeeItem[]
  balance_payments: BalancePayment[]
  created_at: string
}

interface FormData {
  date: string
  studentName: string
  grade: string
  term: string
  admissionNumber: string
  parentName: string
  tuitionFee: string
  lessonLevy: string
  ptaLevyOld: string
  extraCurriculum: string
  developmentLevy: string
  ptaLevyNew: string
  registrationForm: string
  schoolUniform: string
  peOutfit: string
  stockings: string
  cardigan: string
  idCard: string
  assessmentBooklet: string
  endOfYearParty: string
  endOfSessionParty: string
  transportation: string
  juniorWaec: string
  seniorWaec: string
}

// ================ CONSTANTS ================

const gradeOptions = [
  'Angel',
  'Rainbow',
  'Glorious Star',
  'Bright Star',
  'Lavender',
  'Year 1',
  'Year 2',
  'Year 3',
  'Year 4',
  'Year 5',
  'Year 6',
  'Year 7',
  'Year 8',
  'Year 9',
  'Year 10',
  'Year 11',
  'Year 12'
]

const termOptions = ['1st Term', '2nd Term', '3rd Term']

const feeItemsConfig = [
  { id: 'tuitionFee', label: 'Tuition Fee' },
  { id: 'lessonLevy', label: 'Lesson Levy (Termly)' },
  { id: 'ptaLevyOld', label: 'P.T.A Levy (Per Family)' },
  { id: 'extraCurriculum', label: 'Extra Curriculum Activities' },
  { id: 'developmentLevy', label: 'Development Levy' },
  { id: 'ptaLevyNew', label: 'P.T.A Levy (New Intake)' },
  { id: 'registrationForm', label: 'Registration Form' },  
  { id: 'schoolUniform', label: 'School Uniform (2 Pairs)' },
  { id: 'peOutfit', label: 'P.E Outfit' },
  { id: 'stockings', label: 'Stockings (2 Pairs)' },  
  { id: 'cardigan', label: 'Cardigan' },
  { id: 'idCard', label: 'I.D Card' },
  { id: 'assessmentBooklet', label: 'Assessment Booklet' },
  { id: 'endOfYearParty', label: 'End of Year Party' },
  { id: 'endOfSessionParty', label: 'End of Session Party' },
  { id: 'transportation', label: 'Transportation Fee' },
  { id: 'juniorWaec', label: 'Junior WAEC Fee' },
  { id: 'seniorWaec', label: 'Senior WAEC Fee' },
]

// ================ SUPABASE INITIALIZATION ================


// ================ MAIN COMPONENT ================

export default function FeeBreakdown() {
  // ================ REFS ================
  const receiptRef = useRef<HTMLDivElement>(null)
  const downloadContainerRef = useRef<HTMLDivElement>(null)
  const modalReceiptRef = useRef<HTMLDivElement>(null)
  const modalDownloadRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // ================ FORM STATE ================
  const [formData, setFormData] = useState<FormData>({
    date: new Date().toISOString().split('T')[0],
    studentName: '',
    grade: '',
    term: '',
    admissionNumber: '',
    parentName: '',
    tuitionFee: '',
    lessonLevy: '',
    ptaLevyOld: '',
    extraCurriculum: '',
    developmentLevy: '',
    ptaLevyNew: '',
    registrationForm: '',
    schoolUniform: '',
    peOutfit: '',
    stockings: '',
    cardigan: '',
    idCard: '',
    assessmentBooklet: '',
    endOfYearParty: '',
    endOfSessionParty: '',
    transportation: '',
    juniorWaec: '',
    seniorWaec: ''
  })

  // ================ BALANCE PAYMENTS STATE ================
  const [balancePayments, setBalancePayments] = useState<BalancePayment[]>([])
  const [showAddBalance, setShowAddBalance] = useState(false)
  const [selectedBalanceItem, setSelectedBalanceItem] = useState('')
  const [balanceAmount, setBalanceAmount] = useState('')
  const [balanceDescription, setBalanceDescription] = useState('')
  const [balanceDate, setBalanceDate] = useState(new Date().toISOString().split('T')[0])

  // ================ RECEIPT STATE ================
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptNumber, setReceiptNumber] = useState('')
  const [downloadFormat, setDownloadFormat] = useState('pdf')
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState('')

  // ================ SEARCH STATE ================
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Receipt[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null)
  const [searchError, setSearchError] = useState('')
  
  // ================ EDIT MODE STATE ================
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingReceiptId, setEditingReceiptId] = useState<number | null>(null)

  // ================ MODAL STATE ================
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalReceipt, setModalReceipt] = useState<Receipt | null>(null)
  const [modalDownloadFormat, setModalDownloadFormat] = useState('pdf')
  const [isModalDownloading, setIsModalDownloading] = useState(false)

  // ================ DELETE CONFIRMATION STATE ================
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [receiptToDelete, setReceiptToDelete] = useState<Receipt | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!showReceipt) return

    const frame = window.requestAnimationFrame(() => {
      receiptRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [showReceipt, receiptNumber])

  // ================ COMPUTED VALUES ================
  const initialFeeItems = useMemo(() => {
    return feeItemsConfig
      .map(item => {
        const value = formData[item.id as keyof FormData] as string
        return {
          id: item.id,
          description: item.label,
          amount: value && parseFloat(value) > 0 ? parseFloat(value).toFixed(2) : null
        }
      })
      .filter(item => item.amount !== null) as FeeItem[]
  }, [formData])

  const grandTotal = useMemo(() => {
    const items = initialFeeItems
    return items.reduce((sum, item) => sum + parseFloat(item.amount || '0'), 0).toFixed(2)
  }, [initialFeeItems])

  const balanceTotal = useMemo(() => {
    return balancePayments.reduce((sum, item) => sum + parseFloat(item.amount), 0).toFixed(2)
  }, [balancePayments])

  const availableFeeItems = useMemo(() => {
    return feeItemsConfig.map(item => ({
      id: item.id,
      label: item.label
    }))
  }, [])

  // ================ UTILITY FUNCTIONS ================

  const generateReceiptNumber = (): string => {
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const dateStr = `${year}${month}${day}`
    
    const random = Math.random().toString(36).substring(2, 7).toUpperCase()
    
    return `RCP-${dateStr}-${random}`
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    
    if (!formData.studentName?.trim()) {
      errors.studentName = 'Student name is required'
    }
    if (!formData.grade) {
      errors.grade = 'Grade is required'
    }
    if (!formData.term) {
      errors.term = 'Term is required'
    }
    if (!formData.admissionNumber?.trim()) {
      errors.admissionNumber = 'Parent/Guardian contact is required'
    }
    if (!formData.parentName?.trim()) {
      errors.parentName = 'Parent/Guardian name is required'
    }

    const hasFeeItem = initialFeeItems.length > 0

    if (!hasFeeItem && balancePayments.length === 0) {
      errors.feeItems = 'At least one fee item or balance payment must be entered'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  // ================ HANDLER FUNCTIONS ================

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { id, value } = e.target
    setFormData(prev => ({
      ...prev,
      [id]: value === undefined ? '' : value
    }))
    
    if (validationErrors[id]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[id]
        return newErrors
      })
    }
  }

  const addBalancePayment = () => {
    if (!selectedBalanceItem) {
      alert('Please select a fee item')
      return
    }

    if (!balanceAmount || parseFloat(balanceAmount) <= 0) {
      alert('Please enter a valid amount')
      return
    }

    const selectedItem = feeItemsConfig.find(item => item.id === selectedBalanceItem)
    if (!selectedItem) return

    const newBalancePayment: BalancePayment = {
      id: Date.now().toString(),
      itemId: selectedBalanceItem,
      itemName: selectedItem.label,
      amount: parseFloat(balanceAmount).toFixed(2),
      description: balanceDescription || `Balance payment for ${selectedItem.label}`,
      date: balanceDate
    }

    setBalancePayments([...balancePayments, newBalancePayment])
    
    setSelectedBalanceItem('')
    setBalanceAmount('')
    setBalanceDescription('')
    setShowAddBalance(false)
  }

  const removeBalancePayment = (id: string) => {
    setBalancePayments(balancePayments.filter(item => item.id !== id))
  }

  const clearAllBalances = () => {
    if (balancePayments.length > 0 && window.confirm('Clear all balance payments?')) {
      setBalancePayments([])
    }
  }

  const saveToSupabase = async (
    receiptData: any,
    initialItems: FeeItem[],
    balanceItems: BalancePayment[],
    grandTotal: string,
    balanceTotal: string
  ) => {
    try {
      const data = await receiptApi.create({
            receipt_number: receiptData.receiptNumber,
            date: receiptData.date,
            student_name: receiptData.studentName,
            grade: receiptData.grade,
            term: receiptData.term,
            admission_number: receiptData.admissionNumber,
            parent_name: receiptData.parentName,
            total_amount: parseFloat(grandTotal),
            balance_total: parseFloat(balanceTotal),
            fee_items: initialItems,
            balance_payments: balanceItems
          })
      return { success: true, data }
    } catch (error: any) {
      console.error('Error in saveToSupabase:', error)
      return { success: false, error: error.message }
    }
  }

  const handleGenerateReceipt = async () => {
    if (!validateForm()) return

    const newReceiptNumber = generateReceiptNumber()
    setReceiptNumber(newReceiptNumber)
    setShowReceipt(true)
    setSaveStatus(null)
    setSaveMessage('')
    setSelectedReceipt(null)
    setIsEditMode(false)
    setEditingReceiptId(null)
    
    setIsSaving(true)
    
    const receiptData = {
      receiptNumber: newReceiptNumber,
      date: formData.date,
      studentName: formData.studentName,
      grade: formData.grade,
      term: formData.term,
      admissionNumber: formData.admissionNumber,
      parentName: formData.parentName
    }

    const result = await saveToSupabase(receiptData, initialFeeItems, balancePayments, grandTotal, balanceTotal)
    
    if (result.success) {
      setSaveStatus('success')
      setSaveMessage('Receipt saved successfully!')
    } else {
      setSaveStatus('error')
      setSaveMessage(`Failed to save receipt: ${result.error}`)
    }
    
    setIsSaving(false)
    
    setTimeout(() => {
      setSaveStatus(null)
      setSaveMessage('')
    }, 3000)
  }

  const handleReset = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      studentName: '',
      grade: '',
      term: '',
      admissionNumber: '',
      parentName: '',
      tuitionFee: '',
      lessonLevy: '',
      ptaLevyOld: '',
      extraCurriculum: '',
      developmentLevy: '',
      ptaLevyNew: '',
      registrationForm: '',
      schoolUniform: '',
      peOutfit: '',
      stockings: '',
      cardigan: '',
      idCard: '',
      assessmentBooklet: '',
      endOfYearParty: '',
      endOfSessionParty: '',
      transportation: '',
      juniorWaec: '',
      seniorWaec: ''
    })
    setBalancePayments([])
    setShowReceipt(false)
    setValidationErrors({})
    setReceiptNumber('')
    setSaveStatus(null)
    setSaveMessage('')
    setSelectedReceipt(null)
    setIsEditMode(false)
    setEditingReceiptId(null)
  }

  // ================ SEARCH FUNCTIONS ================

  const searchReceipts = async () => {
    if (!searchQuery.trim()) {
      setSearchError('Please enter a student name to search')
      return
    }

    setIsSearching(true)
    setSearchError('')
    setSearchResults([])

    try {
      const data = await receiptApi.list(searchQuery)

      setSearchResults(data || [])
      setShowSearchResults(true)
      
      if (data?.length === 0) {
        setSearchError('No receipts found for this student')
      }
    } catch (error) {
      console.error('Error searching receipts:', error)
      setSearchError('Failed to search receipts. Please try again.')
    } finally {
      setIsSearching(false)
    }
  }

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    if (e.target.value === '') {
      setShowSearchResults(false)
      setSearchResults([])
      setSearchError('')
    }
  }

  const clearSearch = () => {
    setSearchQuery('')
    setSearchResults([])
    setShowSearchResults(false)
    setSearchError('')
    setSelectedReceipt(null)
    setIsEditMode(false)
    setEditingReceiptId(null)
    if (searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchReceipts()
    }
  }

  // ================ EDIT FUNCTIONS ================

  const editReceipt = (receipt: Receipt) => {
    setSelectedReceipt(receipt)
    setEditingReceiptId(receipt.id)
    setIsEditMode(true)
    setShowSearchResults(false)
    
    const feeItems = receipt.fee_items || []
    const feeData: Partial<FormData> = {}
    
    feeItems.forEach(item => {
      const fieldId = feeItemsConfig.find(config => config.label === item.description)?.id
      if (fieldId) {
        (feeData as any)[fieldId] = item.amount
      }
    })

    if (receipt.balance_payments) {
      setBalancePayments(receipt.balance_payments)
    } else {
      setBalancePayments([])
    }

    setFormData({
      date: receipt.date,
      studentName: receipt.student_name,
      grade: receipt.grade,
      term: receipt.term,
      admissionNumber: receipt.admission_number,
      parentName: receipt.parent_name,
      ...feeData as any
    })

    setReceiptNumber(receipt.receipt_number)
    setShowReceipt(true)
  }

  const cancelEdit = () => {
    setIsEditMode(false)
    setEditingReceiptId(null)
    setSelectedReceipt(null)
    handleReset()
  }

  const updateReceipt = async () => {
    if (!validateForm() || !editingReceiptId) return

    setIsSaving(true)
    setSaveStatus(null)
    setSaveMessage('')
    
    const receiptData = {
      date: formData.date,
      studentName: formData.studentName,
      grade: formData.grade,
      term: formData.term,
      admissionNumber: formData.admissionNumber,
      parentName: formData.parentName
    }

    try {
      const data = await receiptApi.update(editingReceiptId, {
          date: receiptData.date,
          student_name: receiptData.studentName,
          grade: receiptData.grade,
          term: receiptData.term,
          admission_number: receiptData.admissionNumber,
          parent_name: receiptData.parentName,
          total_amount: parseFloat(grandTotal),
          balance_total: parseFloat(balanceTotal),
          fee_items: initialFeeItems,
          balance_payments: balancePayments
        })
      
      setSaveStatus('success')
      setSaveMessage('Receipt updated successfully!')
      
      if (searchQuery) {
        searchReceipts()
      }
    } catch (error: any) {
      console.error('Error updating receipt:', error)
      setSaveStatus('error')
      setSaveMessage(`Failed to update receipt: ${error.message}`)
    }
    
    setIsSaving(false)
    
    setTimeout(() => {
      setSaveStatus(null)
      setSaveMessage('')
    }, 3000)
  }

  // ================ MODAL FUNCTIONS ================

  const openReceiptModal = (receipt: Receipt) => {
    setModalReceipt(receipt)
    setIsModalOpen(true)
    document.body.style.overflow = 'hidden'
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setModalReceipt(null)
    document.body.style.overflow = 'unset'
  }

  // ================ DELETE FUNCTIONS ================

  const confirmDelete = (receipt: Receipt) => {
    setReceiptToDelete(receipt)
    setShowDeleteConfirm(true)
  }

  const cancelDelete = () => {
    setShowDeleteConfirm(false)
    setReceiptToDelete(null)
  }

  const deleteReceipt = async () => {
    if (!receiptToDelete) return

    setIsDeleting(true)

    try {
      await receiptApi.remove(receiptToDelete.id)

      setSearchResults(prevResults => 
        prevResults.filter(r => r.id !== receiptToDelete.id)
      )

      if (isModalOpen && modalReceipt?.id === receiptToDelete.id) {
        closeModal()
      }

      if (editingReceiptId === receiptToDelete.id) {
        cancelEdit()
      }

      setSaveStatus('success')
      setSaveMessage('Receipt deleted successfully!')
    } catch (error) {
      console.error('Error deleting receipt:', error)
      setSaveStatus('error')
      setSaveMessage('Failed to delete receipt. Please try again.')
    }
    
    setIsDeleting(false)
    setShowDeleteConfirm(false)
    setReceiptToDelete(null)
    
    setTimeout(() => {
      setSaveStatus(null)
      setSaveMessage('')
    }, 3000)
  }

  // ================ DOWNLOAD FUNCTIONS ================

  const downloadAsPDF = async () => {
    if (!downloadContainerRef.current) return
    
    try {
      downloadContainerRef.current.style.padding = '40px'
      downloadContainerRef.current.style.backgroundColor = '#ffffff'
      
      const canvas = await html2canvas(downloadContainerRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        allowTaint: false,
        useCORS: true,
        windowWidth: downloadContainerRef.current.scrollWidth + 80,
        windowHeight: downloadContainerRef.current.scrollHeight + 80
      })
      
      downloadContainerRef.current.style.padding = ''
      downloadContainerRef.current.style.backgroundColor = ''
      
      const imgData = canvas.toDataURL('image/png')
      const imgWidth = 210
      const pageHeight = 297
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      
      const pdf = new jsPDF({
        orientation: imgHeight > pageHeight ? 'portrait' : 'portrait',
        unit: 'mm'
      })
      
      pdf.addImage(imgData, 'PNG', 10, 10, imgWidth - 20, imgHeight - 20)
      pdf.save(`receipt-${receiptNumber}.pdf`)
    } catch (error) {
      console.error('Error generating PDF:', error)
    }
  }

  const downloadAsJPEG = async () => {
    if (!downloadContainerRef.current) return
    
    try {
      downloadContainerRef.current.style.padding = '40px'
      downloadContainerRef.current.style.backgroundColor = '#ffffff'
      
      const canvas = await html2canvas(downloadContainerRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        allowTaint: false,
        useCORS: true
      })
      
      downloadContainerRef.current.style.padding = ''
      downloadContainerRef.current.style.backgroundColor = ''
      
      const padding = 40
      const borderedCanvas = document.createElement('canvas')
      borderedCanvas.width = canvas.width + (padding * 2)
      borderedCanvas.height = canvas.height + (padding * 2)
      
      const ctx = borderedCanvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, borderedCanvas.width, borderedCanvas.height)
        ctx.drawImage(canvas, padding, padding, canvas.width, canvas.height)
      }
      
      const link = document.createElement('a')
      link.download = `receipt-${receiptNumber}.jpeg`
      link.href = borderedCanvas.toDataURL('image/jpeg', 0.95)
      link.click()
    } catch (error) {
      console.error('Error generating JPEG:', error)
    }
  }

  const handleDownload = () => {
    if (downloadFormat === 'pdf') {
      downloadAsPDF()
    } else {
      downloadAsJPEG()
    }
  }

  const downloadModalAsPDF = async () => {
    if (!modalDownloadRef.current || !modalReceipt) return
    
    setIsModalDownloading(true)
    
    try {
      modalDownloadRef.current.style.padding = '40px'
      modalDownloadRef.current.style.backgroundColor = '#ffffff'
      
      const canvas = await html2canvas(modalDownloadRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        allowTaint: false,
        useCORS: true,
        windowWidth: modalDownloadRef.current.scrollWidth + 80,
        windowHeight: modalDownloadRef.current.scrollHeight + 80
      })
      
      modalDownloadRef.current.style.padding = ''
      modalDownloadRef.current.style.backgroundColor = ''
      
      const imgData = canvas.toDataURL('image/png')
      const imgWidth = 210
      const pageHeight = 297
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      
      const pdf = new jsPDF({
        orientation: imgHeight > pageHeight ? 'portrait' : 'portrait',
        unit: 'mm'
      })
      
      pdf.addImage(imgData, 'PNG', 10, 10, imgWidth - 20, imgHeight - 20)
      pdf.save(`receipt-${modalReceipt.receipt_number}.pdf`)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate PDF')
    } finally {
      setIsModalDownloading(false)
    }
  }

  const downloadModalAsJPEG = async () => {
    if (!modalDownloadRef.current || !modalReceipt) return
    
    setIsModalDownloading(true)
    
    try {
      modalDownloadRef.current.style.padding = '40px'
      modalDownloadRef.current.style.backgroundColor = '#ffffff'
      
      const canvas = await html2canvas(modalDownloadRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        allowTaint: false,
        useCORS: true
      })
      
      modalDownloadRef.current.style.padding = ''
      modalDownloadRef.current.style.backgroundColor = ''
      
      const padding = 40
      const borderedCanvas = document.createElement('canvas')
      borderedCanvas.width = canvas.width + (padding * 2)
      borderedCanvas.height = canvas.height + (padding * 2)
      
      const ctx = borderedCanvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, borderedCanvas.width, borderedCanvas.height)
        ctx.drawImage(canvas, padding, padding, canvas.width, canvas.height)
      }
      
      const link = document.createElement('a')
      link.download = `receipt-${modalReceipt.receipt_number}.jpeg`
      link.href = borderedCanvas.toDataURL('image/jpeg', 0.95)
      link.click()
    } catch (error) {
      console.error('Error generating JPEG:', error)
      alert('Failed to generate JPEG')
    } finally {
      setIsModalDownloading(false)
    }
  }

  const handleModalDownload = () => {
    if (modalDownloadFormat === 'pdf') {
      downloadModalAsPDF()
    } else {
      downloadModalAsJPEG()
    }
  }

  // ================ CLEANUP EFFECT ================
  useEffect(() => {
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  // ================ RENDER ================
  return (
    <div className='space-y-4'>
      {/* Navigation Header */}
      <div className='mb-6 flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5'>
        <div className='flex items-center gap-3'>
          <div className='bg-green-100 p-2 rounded-lg'>
            <FileText className='w-6 h-6 text-green-600' />
          </div>
          <div>
            <h1 className='text-xl font-bold text-gray-800'>Celia&apos;s International Schools - Payment Management</h1>
            <p className='text-sm text-gray-500'>Create and manage payment receipts</p>
          </div>
        </div>
        <div className='grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end'>
          <Link href='/finance/paid-receipts'>
            <Button variant='outline' className='w-full border-green-200 text-green-700 hover:bg-green-50 sm:w-auto'>
              <CreditCard className='h-4 w-4' />
              Paid Receipts
            </Button>
          </Link>
          <Link href='/finance/outstanding'>
            <Button className='w-full bg-green-600 text-white hover:bg-green-700 sm:w-auto'>
              <Users className='h-4 w-4' />
              Outstanding Balances
              <BarChart3 className='ml-1 h-4 w-4' />
            </Button>
          </Link>
        </div>
      </div>

      {/* Global Status Message */}
      {saveStatus && (
        <div className={`mb-4 p-3 rounded-lg ${
          saveStatus === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-700' 
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          <p className='text-sm font-medium'>{saveMessage}</p>
        </div>
      )}

      {/* Edit Mode Indicator */}
      {isEditMode && (
        <div className='bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Edit className='w-5 h-5 text-green-600' />
            <span className='text-sm font-medium text-green-700'>
              Editing Receipt: {receiptNumber}
            </span>
          </div>
          <Button
            size='sm'
            variant='outline'
            onClick={cancelEdit}
            className='text-gray-600'
          >
            <X className='w-4 h-4 mr-1' />
            Cancel Edit
          </Button>
        </div>
      )}

      {/* Search Section */}
      <Card className='border-2 border-green-100 bg-green-50/50'>
        <CardHeader>
          <CardTitle className='text-lg font-bold flex items-center gap-2'>
            <Search className='w-5 h-5' />
            Search Previous Receipts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='flex flex-col md:flex-row gap-4'>
            <div className='flex-1 relative'>
              <Input
                ref={searchInputRef}
                type='text'
                placeholder='Enter student name to search...'
                value={searchQuery}
                onChange={handleSearchInputChange}
                onKeyPress={handleSearchKeyPress}
                className='pr-10'
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className='absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600'
                >
                  <X className='w-4 h-4' />
                </button>
              )}
            </div>
            <Button
              onClick={searchReceipts}
              disabled={isSearching}
              className='bg-green-600 hover:bg-green-700 min-w-[120px]'
            >
              {isSearching ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {/* Search Results */}
          {showSearchResults && (
            <div className='mt-4'>
              {searchResults.length > 0 ? (
                <div className='space-y-2'>
                  <p className='text-sm font-medium text-gray-600'>
                    Found {searchResults.length} receipt(s):
                  </p>
                  <div className='grid gap-2 max-h-96 overflow-y-auto pr-2'>
                    {searchResults.map((receipt) => (
                      <div
                        key={receipt.id}
                        className='bg-white p-4 rounded-lg border border-gray-200 hover:border-green-300 hover:shadow-md transition-all'
                      >
                        <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-3'>
                          <div className='flex-1'>
                            <div className='flex items-center gap-2 mb-2'>
                              <User className='w-4 h-4 text-green-500' />
                              <span className='font-semibold'>{receipt.student_name}</span>
                              <span className='text-sm text-gray-500'>({receipt.admission_number})</span>
                              <span className='text-xs bg-gray-100 px-2 py-1 rounded-full'>
                                {receipt.receipt_number}
                              </span>
                            </div>
                            <div className='grid grid-cols-2 md:grid-cols-4 gap-2 text-sm'>
                              <div className='flex items-center gap-1 text-gray-600'>
                                <Calendar className='w-3 h-3' />
                                {new Date(receipt.date).toLocaleDateString()}
                              </div>
                              <div className='flex items-center gap-1 text-gray-600'>
                                <Hash className='w-3 h-3' />
                                {receipt.grade}
                              </div>
                              <div className='flex items-center gap-1 text-gray-600'>
                                <FileText className='w-3 h-3' />
                                {receipt.term}
                              </div>
                              <div className='flex items-center gap-1 text-gray-600'>
                                <CreditCard className='w-3 h-3' />
                                ₦{receipt.total_amount}
                              </div>
                            </div>
                          </div>
                          <div className='flex gap-2'>
                            <Button
                              variant='outline'
                              size='sm'
                              className='text-green-600 border-green-200 hover:bg-green-50'
                              onClick={() => openReceiptModal(receipt)}
                              title='View Receipt'
                            >
                              <Eye className='w-4 h-4' />
                            </Button>
                            <Button
                              variant='outline'
                              size='sm'
                              className='text-green-600 border-green-200 hover:bg-green-50'
                              onClick={() => editReceipt(receipt)}
                              title='Edit Receipt'
                            >
                              <Edit className='w-4 h-4' />
                            </Button>
                            <Button
                              variant='outline'
                              size='sm'
                              className='text-green-600 border-green-200 hover:bg-green-50'
                              onClick={() => confirmDelete(receipt)}
                              title='Delete Receipt'
                            >
                              <Trash2 className='w-4 h-4' />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                searchError && (
                  <div className='text-center py-4 text-gray-500 bg-white rounded-lg border border-gray-200'>
                    <p>{searchError}</p>
                  </div>
                )
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Student Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className='text-lg font-bold'>Student Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <div>
              <h1 className='text-sm mb-2'>Date</h1>
              <Input
                id='date'
                type='date'
                value={formData.date}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <h1 className='text-sm font-medium mb-2'>Pupil/Student Name</h1>
              <Input
                id='studentName'
                type='text'
                value={formData.studentName}
                onChange={handleInputChange}
                placeholder='Enter student name'
                className={`placeholder:text-gray-400 ${validationErrors.studentName ? 'border-green-500' : ''}`}
              />
              {validationErrors.studentName && (
                <p className='text-green-500 text-xs mt-1'>{validationErrors.studentName}</p>
              )}
            </div>
            <div>
              <h1 className='text-sm font-medium mb-2'>Grade</h1>
              <Select
                id='grade'
                value={formData.grade}
                onChange={handleInputChange}
                className={validationErrors.grade ? 'border-green-500' : ''}
              >
                <option value=''>Select Grade</option>
                {gradeOptions.map(grade => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </Select>
              {validationErrors.grade && (
                <p className='text-green-500 text-xs mt-1'>{validationErrors.grade}</p>
              )}
            </div>
            <div>
              <h1 className='text-sm font-medium mb-2'>Term</h1>
              <Select
                id='term'
                value={formData.term}
                onChange={handleInputChange}
                className={validationErrors.term ? 'border-green-500' : ''}
              >
                <option value=''>Select Term</option>
                {termOptions.map(term => (
                  <option key={term} value={term}>
                    {term}
                  </option>
                ))}
              </Select>
              {validationErrors.term && (
                <p className='text-green-500 text-xs mt-1'>{validationErrors.term}</p>
              )}
            </div>
            <div>
              <h1 className='text-sm font-medium mb-2'>Parent/Guardian Contact</h1>
              <Input
                id='admissionNumber'
                type='text'
                placeholder='Enter Parent/Guardian contact'
                className={`placeholder:text-gray-400 ${validationErrors.admissionNumber ? 'border-green-500' : ''}`}
                value={formData.admissionNumber}
                onChange={handleInputChange}
              />
              {validationErrors.admissionNumber && (
                <p className='text-green-500 text-xs mt-1'>{validationErrors.admissionNumber}</p>
              )}
            </div>
            <div>
              <h1 className='text-sm font-medium mb-2'>Parent/Guardian Name</h1>
              <Input
                id='parentName'
                type='text'
                placeholder='Enter Parent name'
                className={`placeholder:text-gray-400 ${validationErrors.parentName ? 'border-green-500' : ''}`}
                value={formData.parentName}
                onChange={handleInputChange}
              />
              {validationErrors.parentName && (
                <p className='text-green-500 text-xs mt-1'>{validationErrors.parentName}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fee Breakdown Card */}
      <Card>
        <CardHeader>
          <CardTitle className='text-lg font-bold'>Fee Breakdown</CardTitle>
          {validationErrors.feeItems && (
            <p className='text-green-500 text-sm mt-1'>{validationErrors.feeItems}</p>
          )}
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
            {feeItemsConfig.map((item) => (
              <div key={item.id}>
                <h1 className='text-sm font-medium mb-2'>{item.label}</h1>
                <div className='relative'>
                  <span className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500'>₦</span>
                  <Input
                    id={item.id}
                    type='number'
                    step='0.01'
                    value={formData[item.id as keyof FormData] as string}
                    onChange={handleInputChange}
                    placeholder='0.00'
                    className='pl-8'
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Balance Payments Section */}
      <Card className='border-2 border-green-200 bg-green-50/50'>
        <CardHeader>
          <CardTitle className='text-lg font-bold flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <RotateCcw className='w-5 h-5 text-green-600' />
              Balance Payments
              <span className='text-sm font-normal text-gray-500 ml-2'>
                (Separate from grand total - for tracking only)
              </span>
            </div>
            <div className='flex gap-2'>
              <Button
                size='sm'
                variant='outline'
                className='text-green-600 border-green-300 hover:bg-green-100'
                onClick={() => setShowAddBalance(true)}
              >
                <PlusCircle className='w-4 h-4 mr-1' />
                Add Balance Payment
              </Button>
              {balancePayments.length > 0 && (
                <Button
                  size='sm'
                  variant='outline'
                  className='text-green-600 border-green-300 hover:bg-green-50'
                  onClick={clearAllBalances}
                >
                  <MinusCircle className='w-4 h-4 mr-1' />
                  Clear All
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Add Balance Form */}
          {showAddBalance && (
            <div className='mb-6 p-4 bg-white rounded-lg border-2 border-green-200'>
              <h3 className='font-medium mb-3 text-green-800'>Add New Balance Payment</h3>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div>
                  <label className='text-sm font-medium mb-2 block'>Select Fee Item</label>
                  <Select
                    value={selectedBalanceItem}
                    onChange={(e) => setSelectedBalanceItem(e.target.value)}
                  >
                    <option value=''>Select an item...</option>
                    {availableFeeItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className='text-sm font-medium mb-2 block'>Amount (₦)</label>
                  <div className='relative'>
                    <span className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500'>₦</span>
                    <Input
                      type='number'
                      step='0.01'
                      value={balanceAmount}
                      onChange={(e) => setBalanceAmount(e.target.value)}
                      placeholder='0.00'
                      className='pl-8'
                    />
                  </div>
                </div>
                <div>
                  <label className='text-sm font-medium mb-2 block'>Description</label>
                  <Input
                    type='text'
                    value={balanceDescription}
                    onChange={(e) => setBalanceDescription(e.target.value)}
                    placeholder='Enter description (optional)'
                  />
                </div>
                <div>
                  <label className='text-sm font-medium mb-2 block'>Date</label>
                  <Input
                    type='date'
                    value={balanceDate}
                    onChange={(e) => setBalanceDate(e.target.value)}
                  />
                </div>
              </div>
              <div className='flex justify-end gap-2 mt-4'>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => setShowAddBalance(false)}
                >
                  Cancel
                </Button>
                <Button
                  size='sm'
                  className='bg-green-600 hover:bg-green-700 text-white'
                  onClick={addBalancePayment}
                >
                  Add Payment
                </Button>
              </div>
            </div>
          )}

          {/* Balance Payments List */}
          {balancePayments.length > 0 ? (
            <div className='space-y-2'>
              <p className='text-sm font-medium text-gray-600'>
                Balance Payments Added (Not included in grand total):
              </p>
              {balancePayments.map((item) => (
                <div
                  key={item.id}
                  className='flex items-center justify-between bg-white p-3 rounded-lg border border-green-200 hover:shadow-sm'
                >
                  <div className='flex-1'>
                    <div className='flex items-center gap-2'>
                      <RotateCcw className='w-4 h-4 text-green-600' />
                      <span className='font-medium'>{item.itemName}</span>
                    </div>
                    <div className='text-sm text-gray-600 mt-1'>
                      {item.description} - ₦{item.amount} on {new Date(item.date).toLocaleDateString()}
                    </div>
                  </div>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='text-green-600 hover:text-green-700 hover:bg-green-50'
                    onClick={() => removeBalancePayment(item.id)}
                  >
                    <X className='w-4 h-4' />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className='text-center py-6 text-gray-500'>
              <p>No balance payments added yet.</p>
              <p className='text-sm mt-1'>
                Click "Add Balance Payment" to add balance payments for tracking.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Total Amounts Card */}
      <Card>
        <CardContent className='p-6'>
          <div className='space-y-3'>
            <div className='flex justify-between items-center text-gray-600'>
              <p>Grand Total (Fee Breakdown):</p>
              <p className='font-bold text-lg text-green-600'>₦{grandTotal}</p>
            </div>
            {balancePayments.length > 0 && (
              <div className='flex justify-between items-center text-green-600 pt-2 border-t border-gray-200'>
                <p>Balance Payments Total (Separate):</p>
                <p className='font-bold text-lg'>₦{balanceTotal}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className='flex justify-end mt-6 gap-4'>
        <Button onClick={handleReset} variant='outline' disabled={isSaving}>
          Reset Form
        </Button>
        {isEditMode ? (
          <Button
            onClick={updateReceipt}
            className='bg-green-600 hover:bg-green-700 text-white'
            disabled={isSaving}
          >
            <Save className='w-4 h-4 mr-2' />
            {isSaving ? 'Updating...' : 'Update Receipt'}
          </Button>
        ) : (
          <Button
            onClick={handleGenerateReceipt}
            className='bg-green-600 hover:bg-green-700 text-white'
            disabled={isSaving}
          >
            {isSaving ? 'Saving to Supabase...' : 'Generate Receipt'}
          </Button>
        )}
      </div>

      {/* Receipt Preview */}
      {showReceipt && (
        <Card className='print:shadow-none print:border-2 print:m-0'>
          <CardContent className='p-6'>
            {/* Download Container */}
            <div ref={downloadContainerRef} className='bg-white'>
              <div ref={receiptRef}>
                {/* School Header */}
                <div className='text-center mb-6 border-b pb-4'>
                  <div className='flex justify-center mb-1'>
                    <Image
                      src={Logo}
                      alt="Celia's school logo"
                      width={120}
                      height={115}
                      className='h-auto w-28'
                    />
                  </div>
                  <h1 className='text-2xl font-bold text-gray-800'>
                    Celia&apos;s International Schools
                  </h1>
                  <p className='text-sm text-gray-600'>
                    7 Rumuadaolu Market Road, Port Harcourt
                  </p>
                  <p className='text-sm text-gray-600'>
                    Phone: 08037704397 | Email: Admin@celiasschools.org
                  </p>
                </div>

                {/* Receipt Title */}
                <div className='flex justify-between items-center mb-6'>
                  <h2 className='text-xl font-bold text-gray-800'>
                    OFFICIAL RECEIPT
                  </h2>
                  <div className='text-right'>
                    <p className='text-sm font-medium'>
                      Receipt No: <span className='font-bold'>{receiptNumber}</span>
                    </p>
                    <p className='text-sm'>
                      Date:{' '}
                      {new Date(formData.date).toLocaleDateString('en-KE', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>

                {/* Student Details Grid */}
                <div className='grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg'>
                  <div>
                    <p className='text-xs text-gray-500 uppercase'>Student Name</p>
                    <p className='font-semibold'>{formData.studentName || ''}</p>
                  </div>
                  <div>
                    <p className='text-xs text-gray-500 uppercase'>Parent/Guardian Contact</p>
                    <p className='font-semibold'>{formData.admissionNumber || ''}</p>
                  </div>
                  <div>
                    <p className='text-xs text-gray-500 uppercase'>Grade/Class</p>
                    <p className='font-semibold'>{formData.grade || ''}</p>
                  </div>
                  <div>
                    <p className='text-xs text-gray-500 uppercase'>Term</p>
                    <p className='font-semibold'>{formData.term || ''}</p>
                  </div>
                  <div className='col-span-2'>
                    <p className='text-xs text-gray-500 uppercase'>Parent/Guardian</p>
                    <p className='font-semibold'>{formData.parentName || ''}</p>
                  </div>
                </div>

                {/* Payment Details Table */}
                <div className='mb-6'>
                  <h3 className='font-semibold mb-2 text-gray-700'>Payment Details:</h3>
                  <table className='w-full border-collapse'>
                    <thead>
                      <tr className='bg-gray-100'>
                        <th className='text-left p-2 border'>Description</th>
                        <th className='text-right p-2 border'>Amount (₦)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Initial Fee Items */}
                      {initialFeeItems.map((item, index) => (
                        <tr key={`initial-${item.id}`}>
                          <td className="p-2 border">{item.description}</td>
                          <td className="text-right p-2 border">₦{item.amount}</td>
                        </tr>
                      ))}
                      
                      {/* Grand Total Row */}
                      <tr className="bg-green-50 font-bold">
                        <td className="p-2 border text-lg">GRAND TOTAL</td>
                        <td className="text-right p-2 border text-lg text-green-600">
                          ₦{grandTotal}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Balance Payments Section in Receipt */}
                {balancePayments.length > 0 && (
                  <div className='mb-6'>
                    <h3 className='font-semibold mb-2 text-gray-700'>Balance Payments (Separate):</h3>
                    <table className='w-full border-collapse'>
                      <thead>
                        <tr className='bg-gray-100'>
                          <th className='text-left p-2 border'>Description</th>
                          <th className='text-right p-2 border'>Amount (₦)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {balancePayments.map((item, index) => (
                          <tr key={`balance-${item.id}`} className="bg-green-50">
                            <td className="p-2 border">
                              <span className="flex items-center gap-1">
                                <RotateCcw className='w-3 h-3 text-green-600' />
                                {item.description}
                              </span>
                            </td>
                            <td className="text-right p-2 border text-green-700">₦{item.amount}</td>
                          </tr>
                        ))}
                        <tr className="bg-green-100 font-bold">
                          <td className="p-2 border">BALANCE PAYMENTS TOTAL</td>
                          <td className="text-right p-2 border text-green-700">₦{balanceTotal}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Footer Note */}
                <div className='text-center text-xs text-gray-500 mt-4'>
                  <p>
                    This is a computer-generated receipt and is valid without a signature.
                  </p>
                  <p className='mt-1'>
                    Thank you for choosing Celias Schools
                  </p>
                </div>
              </div>
            </div>

            {/* Download Options */}
            <div className='mt-6 flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-end sm:gap-4'>
              <div className='flex shrink-0 items-center gap-2'>
                <label htmlFor='format' className='whitespace-nowrap text-sm font-medium'>Download as:</label>
                <Select
                  id='format'
                  value={downloadFormat}
                  onChange={(e) => setDownloadFormat(e.target.value)}
                  className='min-w-28 flex-1 px-2 py-1 text-sm sm:!w-28 sm:flex-none'
                  disabled={isSaving}
                >
                  <option value='pdf'>PDF</option>
                  <option value='jpeg'>JPEG</option>
                </Select>
              </div>
              <Button
                onClick={handleDownload}
                className='w-full shrink-0 whitespace-nowrap bg-green-600 hover:bg-green-700 sm:w-auto'
                disabled={isSaving}
              >
                <Download className='h-4 w-4' />
                Download {downloadFormat.toUpperCase()}
              </Button>
              <Button 
                onClick={() => setShowReceipt(false)} 
                variant='outline'
                className='w-full shrink-0 whitespace-nowrap sm:w-auto'
                disabled={isSaving}
              >
                Close Preview
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal for Viewing Receipts */}
      {isModalOpen && modalReceipt && (
        <div className='fixed inset-0 z-50 overflow-y-auto'>
          {/* Backdrop */}
          <div 
            className='fixed inset-0 bg-black bg-opacity-50 transition-opacity'
            onClick={closeModal}
          />
          
          {/* Modal */}
          <div className='flex min-h-full items-center justify-center p-4'>
            <div className='relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto'>
              {/* Modal Header */}
              <div className='sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-lg flex justify-between items-center z-10'>
                <h3 className='text-lg font-semibold text-gray-900'>
                  Receipt - {modalReceipt.receipt_number}
                </h3>
                <button
                  onClick={closeModal}
                  className='text-gray-400 hover:text-gray-500 focus:outline-none'
                >
                  <X className='w-6 h-6' />
                </button>
              </div>

              {/* Modal Body - Receipt Content */}
              <div className='p-6'>
                <div ref={modalDownloadRef} className='bg-white'>
                  {/* School Header */}
                  <div className='text-center mb-6 border-b pb-4'>
                    <div className='flex justify-center mb-1'>
                      <Image
                        src={Logo}
                        alt="Celia's school logo"
                        width={120}
                        height={115}
                        className='h-auto w-28'
                      />
                    </div>
                    <h1 className='text-2xl font-bold text-gray-800'>
                      Celia&apos;s International Schools
                    </h1>
                    <p className='text-sm text-gray-600'>
                      7 Rumuadaolu Market Road, Port Harcourt
                    </p>
                    <p className='text-sm text-gray-600'>
                      Phone: 08037704397 | Email: Admin@celiasschools.org
                    </p>
                  </div>

                  {/* Receipt Title */}
                  <div className='flex justify-between items-center mb-6'>
                    <h2 className='text-xl font-bold text-gray-800'>
                      OFFICIAL RECEIPT
                    </h2>
                    <div className='text-right'>
                      <p className='text-sm font-medium'>
                        Receipt No: <span className='font-bold'>{modalReceipt.receipt_number}</span>
                      </p>
                      <p className='text-sm'>
                        Date:{' '}
                        {new Date(modalReceipt.date).toLocaleDateString('en-KE', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Student Details Grid */}
                  <div className='grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg'>
                    <div>
                      <p className='text-xs text-gray-500 uppercase'>Student Name</p>
                      <p className='font-semibold'>{modalReceipt.student_name}</p>
                    </div>
                    <div>
                      <p className='text-xs text-gray-500 uppercase'>Parent/Guardian Contact</p>
                      <p className='font-semibold'>{modalReceipt.admission_number}</p>
                    </div>
                    <div>
                      <p className='text-xs text-gray-500 uppercase'>Grade/Class</p>
                      <p className='font-semibold'>{modalReceipt.grade}</p>
                    </div>
                    <div>
                      <p className='text-xs text-gray-500 uppercase'>Term</p>
                      <p className='font-semibold'>{modalReceipt.term}</p>
                    </div>
                    <div className='col-span-2'>
                      <p className='text-xs text-gray-500 uppercase'>Parent/Guardian</p>
                      <p className='font-semibold'>{modalReceipt.parent_name}</p>
                    </div>
                  </div>

                  {/* Payment Details Table */}
                  <div className='mb-6'>
                    <h3 className='font-semibold mb-2 text-gray-700'>Payment Details:</h3>
                    <table className='w-full border-collapse'>
                      <thead>
                        <tr className='bg-gray-100'>
                          <th className='text-left p-2 border'>Description</th>
                          <th className='text-right p-2 border'>Amount (₦)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Initial Fee Items */}
                        {modalReceipt.fee_items && modalReceipt.fee_items.map((item, index) => (
                          <tr key={`modal-initial-${index}`}>
                            <td className="p-2 border">{item.description}</td>
                            <td className="text-right p-2 border">₦{item.amount}</td>
                          </tr>
                        ))}
                        
                        {/* Grand Total Row */}
                        <tr className="bg-green-50 font-bold">
                          <td className="p-2 border text-lg">GRAND TOTAL</td>
                          <td className="text-right p-2 border text-lg text-green-600">
                            ₦{modalReceipt.total_amount}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Balance Payments Section */}
                  {modalReceipt.balance_payments && modalReceipt.balance_payments.length > 0 && (
                    <div className='mb-6'>
                      <h3 className='font-semibold mb-2 text-gray-700'>Balance Payments (Separate):</h3>
                      <table className='w-full border-collapse'>
                        <thead>
                          <tr className='bg-gray-100'>
                            <th className='text-left p-2 border'>Description</th>
                            <th className='text-right p-2 border'>Amount (₦)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {modalReceipt.balance_payments.map((payment, index) => (
                            <tr key={`modal-balance-${index}`} className="bg-green-50">
                              <td className="p-2 border">
                                <span className="flex items-center gap-1">
                                  <RotateCcw className='w-3 h-3 text-green-600' />
                                  {payment.description}
                                </span>
                              </td>
                              <td className="text-right p-2 border text-green-700">₦{payment.amount}</td>
                            </tr>
                          ))}
                          <tr className="bg-green-100 font-bold">
                            <td className="p-2 border">BALANCE PAYMENTS TOTAL</td>
                            <td className="text-right p-2 border text-green-700">₦{modalReceipt.balance_total || 0}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Footer Note */}
                  <div className='text-center text-xs text-gray-500 mt-4'>
                    <p>
                      This is a computer-generated receipt and is valid without a signature.
                    </p>
                    <p className='mt-1'>
                      Thank you for choosing Celias Schools
                    </p>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className='sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 rounded-b-lg flex justify-end gap-3'>
                <div className='flex items-center gap-2 mr-auto'>
                  <label htmlFor='modalFormat' className='text-sm font-medium text-gray-700'>
                    Download as:
                  </label>
                  <Select
                    id='modalFormat'
                    value={modalDownloadFormat}
                    onChange={(e) => setModalDownloadFormat(e.target.value)}
                    className='w-auto px-2 py-1 text-sm'
                  >
                    <option value='pdf'>PDF</option>
                    <option value='jpeg'>JPEG</option>
                  </Select>
                </div>
                <Button
                  onClick={handleModalDownload}
                  className='bg-green-600 hover:bg-green-700'
                  disabled={isModalDownloading}
                >
                  <Download className='w-4 h-4 mr-2' />
                  {isModalDownloading ? 'Downloading...' : `Download ${modalDownloadFormat.toUpperCase()}`}
                </Button>
                <Button
                  variant='outline'
                  className='text-green-600 border-green-200 hover:bg-green-50'
                  onClick={() => {
                    closeModal()
                    editReceipt(modalReceipt)
                  }}
                >
                  <Edit className='w-4 h-4 mr-2' />
                  Edit
                </Button>
                <Button
                  variant='outline'
                  className='text-green-600 border-green-200 hover:bg-green-50'
                  onClick={() => {
                    closeModal()
                    confirmDelete(modalReceipt)
                  }}
                >
                  <Trash2 className='w-4 h-4 mr-2' />
                  Delete
                </Button>
                <Button
                  onClick={closeModal}
                  variant='outline'
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && receiptToDelete && (
        <div className='fixed inset-0 z-50 overflow-y-auto'>
          {/* Backdrop */}
          <div 
            className='fixed inset-0 bg-black bg-opacity-50 transition-opacity'
            onClick={cancelDelete}
          />
          
          {/* Confirmation Modal */}
          <div className='flex min-h-full items-center justify-center p-4'>
            <div className='relative bg-white rounded-lg shadow-xl max-w-md w-full'>
              <div className='p-6'>
                <div className='flex items-center justify-center mb-4 text-green-600'>
                  <AlertTriangle className='w-12 h-12' />
                </div>
                <h3 className='text-lg font-semibold text-center text-gray-900 mb-2'>
                  Delete Receipt
                </h3>
                <p className='text-sm text-center text-gray-500 mb-6'>
                  Are you sure you want to delete this receipt for{' '}
                  <span className='font-semibold'>{receiptToDelete.student_name}</span>?
                  <br />
                  Receipt Number: <span className='font-semibold'>{receiptToDelete.receipt_number}</span>
                  <br />
                  This action cannot be undone.
                </p>
                <div className='flex justify-center gap-3'>
                  <Button
                    onClick={cancelDelete}
                    variant='outline'
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={deleteReceipt}
                    className='bg-green-600 hover:bg-green-700 text-white'
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Deleting...' : 'Delete Receipt'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ================ COMPONENT ENDS HERE ================
