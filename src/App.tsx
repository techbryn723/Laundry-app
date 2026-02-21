/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Receipt, 
  FileText,
  Download,
  Printer,
  FileSpreadsheet,
  Settings as SettingsIcon, 
  Plus, 
  Search, 
  Moon, 
  Sun, 
  ShoppingBag, 
  Footprints,
  LayoutDashboard,
  TrendingUp,
  Package,
  CheckCircle2,
  Clock,
  ArrowRight,
  Upload,
  Trash2,
  Menu,
  X,
  RotateCcw,
  Save,
  Edit,
  QrCode,
  Trash
} from 'lucide-react';
import { cn } from './lib/utils';
import { Customer, Transaction, Settings, TransactionItem } from './types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import QRCode from 'qrcode';

// --- Components ---

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn(
    "glass rounded-3xl md:rounded-4xl p-6 md:p-8 transition-all duration-500",
    "bg-white/90 dark:bg-slate-900/40 border-slate-200/60 dark:border-white/5",
    "hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1",
    className
  )}>
    {children}
  </div>
);

const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className,
  type = 'button',
  disabled
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  className?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
}) => {
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 dark:shadow-none",
    secondary: "bg-white text-indigo-600 hover:bg-indigo-50 border border-indigo-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10",
    ghost: "bg-transparent hover:bg-indigo-50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400 dark:hover:text-white",
    danger: "bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20 dark:shadow-none"
  };

  return (
    <button 
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "px-6 md:px-8 py-3.5 rounded-2xl font-bold transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-3 text-sm md:text-base",
        variants[variant],
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {children}
    </button>
  );
};

const Input = ({ label, ...props }: any) => (
  <div className="space-y-2.5">
    {label && <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 ml-2">{label}</label>}
    <input 
      {...props}
      className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 rounded-2xl px-5 py-4 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-500/40 transition-all duration-300 shadow-sm text-base"
    />
  </div>
);

const Select = ({ label, options, ...props }: any) => (
  <div className="space-y-2.5">
    {label && <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 ml-2">{label}</label>}
    <div className="relative">
      <select 
        {...props}
        className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 rounded-2xl px-5 py-4 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-500/40 transition-all duration-300 appearance-none shadow-sm text-base"
      >
        <option value="" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Pilih...</option>
        {options.map((opt: any) => (
          <option key={opt.value} value={opt.value} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
            {opt.label}
          </option>
        ))}
      </select>
      <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 dark:text-slate-600">
        <ArrowRight size={18} className="rotate-90" />
      </div>
    </div>
  </div>
);

// --- Receipt Modal with QR Code ---
const ReceiptModal = ({ 
  transaction, 
  settings, 
  onClose,
  onPrint 
}: { 
  transaction: Transaction; 
  settings: Settings;
  onClose: () => void;
  onPrint: () => void;
}) => {
  const qrRef = useRef<HTMLCanvasElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrError, setQrError] = useState<string>('');

  useEffect(() => {
    const generateQR = async () => {
      try {
        if (transaction.ticket_number) {
          const url = await QRCode.toDataURL(transaction.ticket_number, {
            width: 150,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#ffffff'
            }
          });
          setQrDataUrl(url);
          setQrError('');
        } else {
          setQrError('Nomor ticket tidak tersedia');
        }
      } catch (e) {
        console.error('QR Code error:', e);
        setQrError('Gagal generate QR Code');
      }
    };
    generateQR();
  }, [transaction.ticket_number]);

  const statusLabels: Record<string, string> = {
    'proses': 'Proses',
    'cicilan': 'Cicilan',
    'lunas': 'Lunas',
    'diambil': 'Diambil'
  };

  const statusColors: Record<string, string> = {
    'proses': 'from-amber-400 to-orange-500',
    'cicilan': 'from-blue-400 to-indigo-500',
    'lunas': 'from-emerald-400 to-teal-500',
    'diambil': 'from-purple-400 to-pink-500'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }} 
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-md"
      >
        {/* Receipt Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl">
          {/* Header with Gradient */}
          <div className={cn(
            "bg-gradient-to-r p-6 text-white",
            statusColors[transaction.status] || 'from-indigo-500 to-purple-600'
          )}>
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold">{settings.business_name || 'Laundry'}</h2>
                <p className="text-white/80 text-sm">{settings.address}</p>
                <p className="text-white/80 text-sm">{settings.phone}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wider opacity-80">Status</p>
                <p className="font-bold text-lg">{statusLabels[transaction.status]}</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            {/* Ticket Info */}
            <div className="text-center border-b border-slate-200 dark:border-slate-700 pb-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Ticket Number</p>
              <p className="text-2xl font-bold text-indigo-600">{transaction.ticket_number}</p>
            </div>

            {/* Customer Info */}
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-slate-500 uppercase">Konsumen</p>
                <p className="font-semibold">{transaction.customer_name}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 uppercase">Tanggal</p>
                <p className="font-semibold">{new Date(transaction.created_at).toLocaleDateString('id-ID')}</p>
              </div>
            </div>

            {/* Items */}
            <div className="border-t border-b border-slate-200 dark:border-slate-700 py-4">
              <p className="text-xs text-slate-500 uppercase mb-2">Item Details</p>
              {transaction.items?.map((item, idx) => (
                <div key={idx} className="flex justify-between py-1">
                  <span>{item.quantity} {item.unit} {item.item_type === 'shoe' ? 'Sepatu' : 'Tas'} - {item.service_type}</span>
                  <span className="font-semibold">Rp {item.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="flex justify-between items-center text-xl">
              <span className="font-bold">TOTAL</span>
              <span className="font-bold text-indigo-600">Rp {transaction.total_amount?.toLocaleString()}</span>
            </div>

            {/* Pickup Date */}
            <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-4">
              <p className="text-xs text-slate-500 uppercase">Tanggal Pengambilan</p>
              <p className="font-semibold">{transaction.pickup_date ? new Date(transaction.pickup_date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '-'}</p>
            </div>

            {/* QR Code */}
            <div className="flex justify-center py-4 bg-white">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR Code" className="w-32 h-32" />
              ) : (
                <div className="w-32 h-32 bg-slate-200 animate-pulse rounded-lg"></div>
              )}
            </div>

            {/* Note */}
            {(transaction as any).note && (
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
                <p className="text-xs text-amber-600 uppercase">Catatan</p>
                <p className="text-sm">{(transaction as any).note}</p>
              </div>
            )}

            {/* Footer */}
            <p className="text-center text-slate-400 text-sm pt-4">
              Scan QR ini untuk mengambil pakaian
            </p>
          </div>

          {/* Action Buttons */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800 flex gap-2">
            <Button onClick={onPrint} className="flex-1 py-3">
              <Printer size={18} /> Cetak
            </Button>
            <Button variant="ghost" onClick={onClose} className="py-3">
              Tutup
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'customers' | 'transactions' | 'reports' | 'settings'>('dashboard');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<Settings>({});
  const [isLoading, setIsLoading] = useState(true);

  // Form States
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showTakenModal, setShowTakenModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [takenNote, setTakenNote] = useState('');
  const [pendingStatusChange, setPendingStatusChange] = useState<{id: number, status: string, pickup_date: string} | null>(null);

  // Report Filters
  const [reportFilter, setReportFilter] = useState({
    type: 'daily' as 'customer' | 'daily' | 'monthly' | 'yearly',
    customerId: '',
    date: new Date().toISOString().split('T')[0],
    month: new Date().toISOString().slice(0, 7),
    year: new Date().getFullYear().toString()
  });

  // Multi-item transaction state
  const [newTransactionItems, setNewTransactionItems] = useState<Partial<TransactionItem>[]>([
    { item_type: 'shoe', service_type: 'Deep Clean', quantity: 1, unit: 'pasang', amount: 50000 }
  ]);

  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isMobileSidebarVisible, setIsMobileSidebarVisible] = useState(false);

  useEffect(() => {
    fetchData();
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [custRes, transRes, settingsRes] = await Promise.all([
        fetch('/api/customers'),
        fetch('/api/transactions'),
        fetch('/api/settings')
      ]);
      const custData = await custRes.json();
      const transData = await transRes.json();
      const settingsData = await settingsRes.json();
      
      setCustomers(custData);
      setTransactions(transData);
      setSettings(settingsData);
      
      if (settingsData.business_name) {
        document.title = settingsData.business_name;
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCustomer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    try {
      const url = editingCustomer ? `/api/customers/${editingCustomer.id}` : '/api/customers';
      const method = editingCustomer ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (res.ok) {
        setShowCustomerModal(false);
        setEditingCustomer(null);
        await fetchData();
      } else {
        const result = await res.json();
        alert(`Gagal menyimpan konsumen: ${result.error || 'Terjadi kesalahan'}`);
      }
    } catch (error) {
      console.error('Error saving customer:', error);
      alert('Terjadi kesalahan koneksi saat menyimpan konsumen.');
    }
  };

  const handleDeleteCustomer = async (id: number) => {
    if (!confirm('Hapus konsumen ini?')) return;
    try {
      const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Error deleting customer:', error);
    }
  };

  const handleAddTransaction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const customer_id = formData.get('customer_id');
    const status = formData.get('status');
    const pickup_date = formData.get('pickup_date');
    
    if (!customer_id || !pickup_date) {
      alert('Silakan lengkapi form.');
      return;
    }

    const total_amount = newTransactionItems.reduce((acc, item) => acc + (item.amount || 0), 0);

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: parseInt(customer_id as string),
          items: newTransactionItems,
          total_amount,
          status,
          pickup_date
        })
      });
      
      const result = await res.json();
      
      if (res.ok) {
        setShowTransactionModal(false);
        setNewTransactionItems([{ item_type: 'shoe', service_type: 'Deep Clean', quantity: 1, unit: 'pasang', amount: 50000 }]);
        fetchData();
      } else {
        alert(`Gagal menyimpan transaksi: ${result.error || 'Terjadi kesalahan'}`);
      }
    } catch (error) {
      console.error('Error adding transaction:', error);
    }
  };

  const handleStatusChangeClick = (id: number, newStatus: string, pickup_date: string) => {
    if (newStatus === 'diambil') {
      setPendingStatusChange({ id, status: newStatus, pickup_date });
      setTakenNote('');
      setShowTakenModal(true);
    } else {
      handleUpdateTransactionStatus(id, newStatus, pickup_date);
    }
  };

  const confirmTakenStatus = () => {
    if (pendingStatusChange) {
      handleUpdateTransactionStatus(pendingStatusChange.id, 'diambil', pendingStatusChange.pickup_date, takenNote);
      setShowTakenModal(false);
      setPendingStatusChange(null);
      setTakenNote('');
    }
  };

  const handleUpdateTransactionStatus = async (id: number, status: string, pickup_date: string, note?: string) => {
    try {
      const res = await fetch(`/api/transactions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, pickup_date, note })
      });
      
      const result = await res.json();
      if (!res.ok) {
        alert(result.error || 'Gagal mengupdate status');
        fetchData();
      } else {
        fetchData();
      }
    } catch (error) {
      console.error('Error updating transaction:', error);
    }
  };

  const handleDeleteTransaction = async (id: number) => {
    if (!confirm('Hapus transaksi ini?')) return;
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) {
        alert(result.error || 'Gagal menghapus transaksi');
      } else {
        await fetchData();
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, key: 'logo' | 'favicon') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('key', key);

    try {
      const res = await fetch('/api/settings/upload', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      business_name: formData.get('business_name') as string,
      address: formData.get('address') as string,
      phone: formData.get('phone') as string
    };

    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (res.ok) {
        alert('Pengaturan berhasil disimpan!');
        fetchData();
      } else {
        const result = await res.json();
        alert(`Gagal menyimpan: ${result.error || 'Terjadi kesalahan'}`);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Terjadi kesalahan koneksi.');
    }
  };

  const handleBackup = async () => {
    try {
      const res = await fetch('/api/backup');
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `laundry-backup-${new Date().toISOString().split('T')[0]}.db`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        alert('Backup berhasil didownload!');
      } else {
        alert('Gagal membuat backup');
      }
    } catch (error) {
      console.error('Error creating backup:', error);
      alert('Terjadi kesalahan saat membuat backup');
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('Apakah Anda yakin ingin merestore database? Data saat ini akan diganti dengan file backup.')) {
      return;
    }

    const formData = new FormData();
    formData.append('backup', file);

    try {
      const res = await fetch('/api/restore', {
        method: 'POST',
        body: formData
      });
      
      if (res.ok) {
        alert('Restore berhasil! Silakan refresh halaman.');
        fetchData();
      } else {
        const result = await res.json();
        alert(`Gagal merestore: ${result.error || 'Terjadi kesalahan'}`);
      }
    } catch (error) {
      console.error('Error restoring:', error);
      alert('Terjadi kesalahan saat merestore database');
    }
  };

  const handleDeleteAllData = async () => {
    if (!confirm('⚠️ PERINGATAN! Anda akan menghapus SEMUA data:\n\n- Semua konsumen\n- Semua transaksi\n\nTindakan ini TIDAK BISA DIURUNGKAN!\n\nApakah Anda yakin?')) {
      return;
    }
    
    if (!confirm('Apakah Anda benar-benar yakin? Semua data akan hilang permanen.')) {
      return;
    }

    try {
      // Delete all transactions first (items will be cascade deleted)
      for (const t of transactions) {
        await fetch(`/api/transactions/${t.id}`, { method: 'DELETE' });
      }
      // Delete all customers
      for (const c of customers) {
        await fetch(`/api/customers/${c.id}`, { method: 'DELETE' });
      }
      
      alert('Semua data berhasil dihapus!');
      fetchData();
    } catch (error) {
      console.error('Error deleting all data:', error);
      alert('Terjadi kesalahan saat menghapus data');
    }
  };

  const openReceipt = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setShowReceiptModal(true);
  };

  const printReceipt = (transaction: Transaction) => {
    openReceipt(transaction);
  };

  const handlePrintFromModal = () => {
    window.print();
  };

  const getFilteredTransactions = () => {
    return transactions.filter(t => {
      const tDate = new Date(t.created_at);
      if (reportFilter.type === 'customer') {
        return t.customer_id.toString() === reportFilter.customerId;
      }
      if (reportFilter.type === 'daily') {
        return t.created_at.startsWith(reportFilter.date);
      }
      if (reportFilter.type === 'monthly') {
        return t.created_at.startsWith(reportFilter.month);
      }
      if (reportFilter.type === 'yearly') {
        return tDate.getFullYear().toString() === reportFilter.year;
      }
      return true;
    });
  };

  const exportToExcel = () => {
    const filtered = getFilteredTransactions();
    const data = filtered.map(t => ({
      'Ticket': t.ticket_number,
      'Konsumen': t.customer_name,
      'Total': t.total_amount,
      'Status': t.status,
      'Tanggal': new Date(t.created_at).toLocaleDateString('id-ID')
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan");
    XLSX.writeFile(wb, `Laporan_${reportFilter.type}_${new Date().getTime()}.xlsx`);
  };

  const generatePDF = (preview = false) => {
    const doc = new jsPDF();
    const filtered = getFilteredTransactions();
    
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, 210, 50, 'F');
    doc.setFillColor(67, 56, 202);
    doc.rect(0, 45, 210, 5, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.text(settings.business_name || 'Laundry', 14, 25);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Laporan Transaksi', 14, 35);
    doc.text(`Alamat: ${settings.address || '-'} | Telp: ${settings.phone || '-'}`, 14, 40);
    
    const tableData = filtered.map(t => [
      t.ticket_number,
      t.customer_name,
      `Rp ${t.total_amount.toLocaleString()}`,
      t.status.toUpperCase(),
      new Date(t.created_at).toLocaleDateString('id-ID')
    ]);

    autoTable(doc, {
      startY: 55,
      head: [['Ticket', 'Konsumen', 'Total', 'Status', 'Tanggal']],
      body: tableData,
      headStyles: { fillColor: [79, 70, 229], fontSize: 10, halign: 'center' },
      bodyStyles: { fontSize: 9, halign: 'center' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { top: 55 },
      styles: { font: 'helvetica' }
    });

    const total = filtered.reduce((acc, curr) => acc + curr.total_amount, 0);
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    
    doc.setFillColor(79, 70, 229);
    doc.roundedRect(130, finalY - 5, 65, 15, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL: Rp ${total.toLocaleString()}`, 135, finalY + 5);

    doc.setTextColor(156, 163, 175);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text('Terima kasih.', 105, 285, { align: 'center' });

    if (preview) {
      const blob = doc.output('bloburl');
      window.open(blob, '_blank');
    } else {
      doc.save(`Laporan_${reportFilter.type}_${new Date().getTime()}.pdf`);
    }
  };

  const stats = {
    totalRevenue: transactions.reduce((acc, curr) => acc + (curr.total_amount || 0), 0),
    totalCustomers: customers.length,
    activeOrders: transactions.filter(t => t.status === 'proses').length,
    completedOrders: transactions.filter(t => t.status === 'diambil').length
  };

  const addTransactionItem = () => {
    setNewTransactionItems([...newTransactionItems, { item_type: 'shoe', service_type: 'Deep Clean', quantity: 1, unit: 'pasang', amount: 50000 }]);
  };

  const removeTransactionItem = (index: number) => {
    setNewTransactionItems(newTransactionItems.filter((_, i) => i !== index));
  };

  const updateTransactionItem = (index: number, field: keyof TransactionItem, value: any) => {
    const updated = [...newTransactionItems];
    updated[index] = { ...updated[index], [field]: value };
    setNewTransactionItems(updated);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'lunas': return "bg-emerald-500 text-white";
      case 'proses': return "bg-amber-500 text-white";
      case 'cicilan': return "bg-blue-500 text-white";
      case 'diambil': return "bg-purple-500 text-white";
      default: return "bg-slate-500 text-white";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'proses': return 'Proses';
      case 'cicilan': return 'Cicilan';
      case 'lunas': return 'Lunas';
      case 'diambil': return 'Diambil';
      default: return status;
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const logoUrl = settings.logo || (settings as any).logo;

  return (
    <div className={cn(
      "min-h-screen gradient-bg transition-colors duration-300",
      isDarkMode ? "text-slate-50 selection:bg-white/30" : "text-slate-900 selection:bg-indigo-100"
    )}>
      {/* Mobile Toggle Button */}
      <button 
        onClick={() => setIsMobileSidebarVisible(true)}
        className={cn(
          "fixed top-4 left-4 z-40 md:hidden p-3 rounded-2xl glass shadow-lg transition-all duration-300 active:scale-90",
          !isDarkMode ? "bg-white/90 text-indigo-600 border-indigo-100" : "bg-slate-900/90 text-white border-white/5"
        )}
      >
        <Menu size={20} />
      </button>

      {/* Sidebar / Navigation */}
      <nav className={cn(
        "fixed top-0 h-full glass border-r-0 z-50 flex flex-col transition-all duration-500 ease-in-out",
        isSidebarExpanded ? "md:w-72 p-6" : "md:w-24 p-4",
        isMobileSidebarVisible ? "left-0 w-72 p-6 shadow-[20px_0_60px_rgba(0,0,0,0.2)]" : "-left-full md:left-0",
        !isDarkMode && "bg-white/95 border-indigo-50 shadow-[10px_0_40px_rgba(79,70,229,0.05)]",
        "rounded-r-4xl md:rounded-r-5xl"
      )}>
        <button 
          onClick={() => setIsMobileSidebarVisible(false)}
          className="absolute top-6 right-6 md:hidden p-2 text-slate-400 hover:text-indigo-600 transition-colors"
        >
          <X size={20} />
        </button>

        <div 
          onClick={() => {
            if (window.innerWidth >= 768) {
              setIsSidebarExpanded(!isSidebarExpanded);
            }
          }}
          className={cn(
            "flex flex-col items-center gap-4 px-2 mb-10 md:mb-14 cursor-pointer group transition-all duration-300",
            !isSidebarExpanded && "md:mb-10"
          )}
        >
          <div className={cn(
            "rounded-2xl flex items-center justify-center overflow-hidden flex-shrink-0 transition-all duration-500 group-hover:scale-110",
            isSidebarExpanded ? "w-12 h-12" : "w-10 h-10",
            !logoUrl && "bg-indigo-600"
          )}>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).parentElement!.classList.add('bg-indigo-600');
                (e.target as HTMLImageElement).parentElement!.innerHTML = '<svg class="text-white w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>';
              }} />
            ) : (
              <ShoppingBag className="text-white w-7 h-7" />
            )}
          </div>
          <span className={cn(
            "font-display font-bold text-2xl tracking-tight text-center transition-all duration-500 overflow-hidden whitespace-nowrap",
            isDarkMode ? "text-white" : "text-indigo-700",
            !isSidebarExpanded ? "w-0 opacity-0" : "w-auto opacity-100",
            !isMobileSidebarVisible && "hidden md:block"
          )}>{settings.business_name || 'Laundry'}</span>
        </div>

        <div className="flex-1 space-y-2 md:space-y-3">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'customers', icon: Users, label: 'Konsumen' },
            { id: 'transactions', icon: Receipt, label: 'Transaksi' },
            { id: 'reports', icon: FileText, label: 'Laporan' },
            { id: 'settings', icon: SettingsIcon, label: 'Pengaturan' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id as any);
                if (window.innerWidth < 768) setIsMobileSidebarVisible(false);
              }}
              className={cn(
                "w-full flex items-center rounded-2xl transition-all duration-300 group",
                isSidebarExpanded ? "p-3 md:p-4 justify-start gap-4" : "p-3 justify-center",
                activeTab === item.id 
                  ? (isDarkMode ? "bg-white/10 text-white shadow-lg" : "bg-indigo-600 text-white shadow-xl shadow-indigo-600/30") 
                  : (isDarkMode ? "text-slate-400 hover:bg-white/5 hover:text-white" : "text-slate-500 hover:bg-indigo-50 hover:text-indigo-600")
              )}
              title={!isSidebarExpanded ? item.label : ""}
            >
              <item.icon size={22} className={cn(
                "transition-transform duration-300 group-hover:scale-110 flex-shrink-0",
                activeTab === item.id ? "scale-110" : ""
              )} />
              <span className={cn(
                "font-bold tracking-wide transition-all duration-300 overflow-hidden whitespace-nowrap",
                !isSidebarExpanded ? "w-0 opacity-0" : "w-auto opacity-100",
                !isMobileSidebarVisible && "hidden md:block"
              )}>{item.label}</span>
            </button>
          ))}
        </div>

        <div className={cn(
          "mt-auto pt-6 border-t border-slate-100 dark:border-white/5 transition-all duration-300",
          isSidebarExpanded ? "space-y-2 md:space-y-3" : "space-y-4"
        )}>
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={cn(
              "w-full flex items-center rounded-2xl transition-all duration-300 group",
              isSidebarExpanded ? "p-3 md:p-4 justify-start gap-4" : "p-3 justify-center",
              isDarkMode ? "text-slate-400 hover:bg-white/5 hover:text-white" : "text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
            )}
          >
            <div className="transition-transform duration-500 group-hover:rotate-12 flex-shrink-0">
              {isDarkMode ? <Sun size={22} /> : <Moon size={22} />}
            </div>
            <span className={cn(
              "font-bold tracking-wide transition-all duration-300 overflow-hidden whitespace-nowrap",
              !isSidebarExpanded ? "w-0 opacity-0" : "w-auto opacity-100",
              !isMobileSidebarVisible && "hidden md:block"
            )}>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className={cn(
        "min-h-screen transition-all duration-500",
        isSidebarExpanded ? "md:ml-72" : "md:ml-24"
      )}>
        <div className="p-4 md:p-8 pt-16 md:pt-8">
          {activeTab === 'dashboard' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="text-3xl md:text-4xl font-display font-bold mb-8">Dashboard</h1>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white hover:from-indigo-400 hover:to-purple-500 hover:shadow-indigo-500/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white/80 text-sm font-medium">Total Pendapatan</p>
                      <p className="text-3xl font-bold mt-2">Rp {stats.totalRevenue.toLocaleString()}</p>
                    </div>
                    <TrendingUp className="w-10 h-10 opacity-50" />
                  </div>
                </Card>
                <Card className="hover:shadow-pink-500/20 hover:-translate-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-500 text-sm font-medium">Total Konsumen</p>
                      <p className="text-3xl font-bold mt-2 text-indigo-600">{stats.totalCustomers}</p>
                    </div>
                    <Users className="w-10 h-10 text-pink-400" />
                  </div>
                </Card>
                <Card className="hover:shadow-amber-500/20 hover:-translate-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-500 text-sm font-medium">Sedang Proses</p>
                      <p className="text-3xl font-bold mt-2 text-amber-500">{stats.activeOrders}</p>
                    </div>
                    <Clock className="w-10 h-10 text-amber-400" />
                  </div>
                </Card>
                <Card className="hover:shadow-emerald-500/20 hover:-translate-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-500 text-sm font-medium">Sudah Diambil</p>
                      <p className="text-3xl font-bold mt-2 text-emerald-500">{stats.completedOrders}</p>
                    </div>
                    <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                  </div>
                </Card>
              </div>

              <Card>
                <h2 className="text-xl font-bold mb-6">Transaksi Terbaru</h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-white/10">
                        <th className="text-left py-4 px-4 text-sm font-bold text-slate-500 uppercase">Ticket</th>
                        <th className="text-left py-4 px-4 text-sm font-bold text-slate-500 uppercase">Konsumen</th>
                        <th className="text-left py-4 px-4 text-sm font-bold text-slate-500 uppercase">Total</th>
                        <th className="text-left py-4 px-4 text-sm font-bold text-slate-500 uppercase">Status</th>
                        <th className="text-left py-4 px-4 text-sm font-bold text-slate-500 uppercase">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.slice(0, 5).map((t) => (
                        <tr key={t.id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5">
                          <td className="py-4 px-4 font-medium">{t.ticket_number}</td>
                          <td className="py-4 px-4">{t.customer_name}</td>
                          <td className="py-4 px-4">Rp {t.total_amount?.toLocaleString()}</td>
                          <td className="py-4 px-4">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-xs font-bold uppercase",
                              getStatusBadgeClass(t.status)
                            )}>{getStatusLabel(t.status)}</span>
                          </td>
                          <td className="py-4 px-4">
                            <Button variant="ghost" onClick={() => printReceipt(t)} className="p-2">
                              <Printer size={18} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          )}

          {activeTab === 'customers' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <h1 className="text-3xl md:text-4xl font-display font-bold">Konsumen</h1>
                <Button onClick={() => { setEditingCustomer(null); setShowCustomerModal(true); }}>
                  <Plus size={20} /> Tambah Konsumen
                </Button>
              </div>
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-white/10">
                        <th className="text-left py-4 px-4 text-sm font-bold text-slate-500 uppercase">Nama</th>
                        <th className="text-left py-4 px-4 text-sm font-bold text-slate-500 uppercase">Telepon</th>
                        <th className="text-left py-4 px-4 text-sm font-bold text-slate-500 uppercase">Alamat</th>
                        <th className="text-left py-4 px-4 text-sm font-bold text-slate-500 uppercase">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.map((c) => (
                        <tr key={c.id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5">
                          <td className="py-4 px-4 font-medium">{c.name}</td>
                          <td className="py-4 px-4">{c.phone}</td>
                          <td className="py-4 px-4">{c.address}</td>
                          <td className="py-4 px-4">
                            <div className="flex gap-2">
                              <Button variant="ghost" onClick={() => { setEditingCustomer(c); setShowCustomerModal(true); }} className="p-2">
                                <SettingsIcon size={18} />
                              </Button>
                              <Button variant="ghost" onClick={() => handleDeleteCustomer(c.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                                <Trash2 size={18} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          )}

          {activeTab === 'transactions' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <h1 className="text-3xl md:text-4xl font-display font-bold">Transaksi</h1>
                <Button onClick={() => setShowTransactionModal(true)}>
                  <Plus size={20} /> Transaksi Baru
                </Button>
              </div>
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-white/10">
                        <th className="text-left py-4 px-4 text-sm font-bold text-slate-500 uppercase">Ticket</th>
                        <th className="text-left py-4 px-4 text-sm font-bold text-slate-500 uppercase">Konsumen</th>
                        <th className="text-left py-4 px-4 text-sm font-bold text-slate-500 uppercase">Total</th>
                        <th className="text-left py-4 px-4 text-sm font-bold text-slate-500 uppercase">Status</th>
                        <th className="text-left py-4 px-4 text-sm font-bold text-slate-500 uppercase">Tgl Pengambilan</th>
                        <th className="text-left py-4 px-4 text-sm font-bold text-slate-500 uppercase">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((t) => {
                        const isTaken = t.status === 'diambil';
                        return (
                        <tr key={t.id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5">
                          <td className="py-4 px-4 font-medium">{t.ticket_number}</td>
                          <td className="py-4 px-4">{t.customer_name}</td>
                          <td className="py-4 px-4">Rp {t.total_amount?.toLocaleString()}</td>
                          <td className="py-4 px-4">
                            <select
                              value={t.status}
                              onChange={(e) => handleStatusChangeClick(t.id, e.target.value, t.pickup_date)}
                              disabled={isTaken}
                              className={cn(
                                "px-3 py-1 rounded-full text-xs font-bold uppercase border-0 cursor-pointer",
                                getStatusBadgeClass(t.status),
                                isTaken && "opacity-60 cursor-not-allowed"
                              )}
                            >
                              <option value="proses">Proses</option>
                              <option value="cicilan">Cicilan</option>
                              <option value="lunas">Lunas</option>
                              <option value="diambil">Diambil</option>
                            </select>
                          </td>
                          <td className="py-4 px-4 text-sm">{formatDate(t.pickup_date)}</td>
                          <td className="py-4 px-4">
                            <div className="flex gap-1">
                              {/* QR Code Button */}
                              <Button variant="ghost" onClick={() => openReceipt(t)} className="p-2" title="Lihat QR Code">
                                <QrCode size={18} />
                              </Button>
                              {/* Print Button */}
                              <Button variant="ghost" onClick={() => printReceipt(t)} className="p-2" title="Cetak Struk">
                                <Printer size={18} />
                              </Button>
                              {/* Delete Button - always enabled */}
                              <Button variant="ghost" onClick={() => handleDeleteTransaction(t.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="Hapus">
                                <Trash2 size={18} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          )}

          {activeTab === 'reports' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="text-3xl md:text-4xl font-display font-bold mb-8">Laporan</h1>
              <Card className="mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <Select
                    label="Tipe Laporan"
                    value={reportFilter.type}
                    onChange={(e: any) => setReportFilter({ ...reportFilter, type: e.target.value })}
                    options={[
                      { value: 'daily', label: 'Harian' },
                      { value: 'monthly', label: 'Bulanan' },
                      { value: 'yearly', label: 'Tahunan' },
                      { value: 'customer', label: 'Per Konsumen' }
                    ]}
                  />
                  {reportFilter.type === 'customer' && (
                    <Select
                      label="Konsumen"
                      value={reportFilter.customerId}
                      onChange={(e: any) => setReportFilter({ ...reportFilter, customerId: e.target.value })}
                      options={customers.map(c => ({ value: c.id.toString(), label: c.name }))}
                    />
                  )}
                  {reportFilter.type === 'daily' && (
                    <Input
                      label="Tanggal"
                      type="date"
                      value={reportFilter.date}
                      onChange={(e: any) => setReportFilter({ ...reportFilter, date: e.target.value })}
                    />
                  )}
                  {reportFilter.type === 'monthly' && (
                    <Input
                      label="Bulan"
                      type="month"
                      value={reportFilter.month}
                      onChange={(e: any) => setReportFilter({ ...reportFilter, month: e.target.value })}
                    />
                  )}
                  {reportFilter.type === 'yearly' && (
                    <Input
                      label="Tahun"
                      type="number"
                      value={reportFilter.year}
                      onChange={(e: any) => setReportFilter({ ...reportFilter, year: e.target.value })}
                    />
                  )}
                </div>
              </Card>

              <div className="flex gap-4 mb-8">
                <Button onClick={() => generatePDF(false)}>
                  <FileText size={20} /> Export PDF
                </Button>
                <Button onClick={() => exportToExcel()}>
                  <FileSpreadsheet size={20} /> Export Excel
                </Button>
              </div>

              <Card>
                <h2 className="text-xl font-bold mb-6">Ringkasan</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center p-6 bg-slate-50 dark:bg-white/5 rounded-2xl">
                    <p className="text-slate-500 text-sm font-medium">Total Transaksi</p>
                    <p className="text-3xl font-bold text-indigo-600 mt-2">{getFilteredTransactions().length}</p>
                  </div>
                  <div className="text-center p-6 bg-slate-50 dark:bg-white/5 rounded-2xl">
                    <p className="text-slate-500 text-sm font-medium">Total Pendapatan</p>
                    <p className="text-3xl font-bold text-emerald-500 mt-2">Rp {getFilteredTransactions().reduce((acc, t) => acc + (t.total_amount || 0), 0).toLocaleString()}</p>
                  </div>
                  <div className="text-center p-6 bg-slate-50 dark:bg-white/5 rounded-2xl">
                    <p className="text-slate-500 text-sm font-medium">Rata-rata per Transaksi</p>
                    <p className="text-3xl font-bold text-amber-500 mt-2">Rp {getFilteredTransactions().length > 0 ? Math.round(getFilteredTransactions().reduce((acc, t) => acc + (t.total_amount || 0), 0) / getFilteredTransactions().length).toLocaleString() : 0}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="text-3xl md:text-4xl font-display font-bold mb-8">Pengaturan</h1>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card>
                  <h2 className="text-xl font-bold mb-6">Informasi Bisnis</h2>
                  <form onSubmit={handleSaveSettings} className="space-y-6">
                    <Input
                      label="Nama Laundry"
                      name="business_name"
                      defaultValue={settings.business_name || ''}
                      placeholder="Sole & Swag Laundry"
                    />
                    <Input
                      label="Alamat"
                      name="address"
                      defaultValue={settings.address || ''}
                      placeholder="Jakarta, Indonesia"
                    />
                    <Input
                      label="Telepon"
                      name="phone"
                      defaultValue={settings.phone || ''}
                      placeholder="+62 812 3456 7890"
                    />
                    <Button type="submit" className="w-full">
                      <Save size={20} /> Simpan Pengaturan
                    </Button>
                  </form>
                </Card>

                <Card>
                  <h2 className="text-xl font-bold mb-6">Logo & Favicon</h2>
                  <div className="space-y-6">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 ml-2 block mb-2">Logo</label>
                      <div className="flex items-center gap-4">
                        <div className="w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden border-2 border-indigo-200 dark:border-indigo-800">
                          {logoUrl ? (
                            <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }} />
                          ) : (
                            <ShoppingBag className="text-indigo-400 w-10 h-10" />
                          )}
                        </div>
                        <label className="flex-1">
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'logo')} />
                          <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl p-4 text-center cursor-pointer hover:border-indigo-500 transition-colors">
                            <Upload className="w-6 h-6 mx-auto text-slate-400" />
                            <p className="text-sm text-slate-500 mt-1">Klik untuk upload</p>
                          </div>
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 ml-2 block mb-2">Favicon</label>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                          {settings.favicon ? (
                            <img src={settings.favicon} alt="Favicon" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs text-slate-400">None</span>
                          )}
                        </div>
                        <label className="flex-1">
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'favicon')} />
                          <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl p-4 text-center cursor-pointer hover:border-indigo-500 transition-colors">
                            <Upload className="w-6 h-6 mx-auto text-slate-400" />
                            <p className="text-sm text-slate-500 mt-1">Klik untuk upload</p>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="lg:col-span-2">
                  <h2 className="text-xl font-bold mb-6">Backup & Restore Database</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                          <Download className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                          <h3 className="font-bold">Backup Database</h3>
                          <p className="text-sm text-slate-500">Simpan salinan database</p>
                        </div>
                      </div>
                      <Button onClick={handleBackup} variant="secondary" className="w-full">
                        <Download size={18} /> Download Backup
                      </Button>
                    </div>
                    <div className="p-6 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                          <RotateCcw className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                          <h3 className="font-bold">Restore Database</h3>
                          <p className="text-sm text-slate-500">Pulihkan dari file backup</p>
                        </div>
                      </div>
                      <label className="block">
                        <input type="file" accept=".db" className="hidden" onChange={handleRestore} />
                        <div className="w-full border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl p-4 text-center cursor-pointer hover:border-amber-500 transition-colors">
                          <RotateCcw className="w-6 h-6 mx-auto text-slate-400" />
                          <p className="text-sm text-slate-500 mt-1">Pilih file backup (.db)</p>
                        </div>
                      </label>
                    </div>
                  </div>
                </Card>

                {/* Delete All Data */}
                <Card className="lg:col-span-2 border-2 border-red-200 dark:border-red-800">
                  <h2 className="text-xl font-bold mb-2 text-red-600">Hapus Semua Data</h2>
                  <p className="text-slate-500 dark:text-slate-400 mb-4">Menghapus semua konsumen dan transaksi. Tindakan ini tidak bisa dibatalkan!</p>
                  <Button onClick={handleDeleteAllData} variant="danger" className="w-full">
                    <Trash size={20} /> Hapus Semua Data
                  </Button>
                </Card>
              </div>
            </motion.div>
          )}
        </div>
      </main>

      {/* Customer Modal */}
      <AnimatePresence>
        {showCustomerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowCustomerModal(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-lg"
            >
              <Card className="max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">{editingCustomer ? 'Edit Konsumen' : 'Tambah Konsumen'}</h2>
                  <Button variant="ghost" onClick={() => setShowCustomerModal(false)} className="p-2">
                    <X size={20} />
                  </Button>
                </div>
                <form onSubmit={handleAddCustomer} className="space-y-4">
                  <Input
                    label="Nama"
                    name="name"
                    defaultValue={editingCustomer?.name || ''}
                    placeholder="John Doe"
                    required
                  />
                  <Input
                    label="Telepon"
                    name="phone"
                    defaultValue={editingCustomer?.phone || ''}
                    placeholder="+62 812 3456 7890"
                  />
                  <Input
                    label="Email"
                    name="email"
                    type="email"
                    defaultValue={editingCustomer?.email || ''}
                    placeholder="john@example.com"
                  />
                  <Input
                    label="Alamat"
                    name="address"
                    defaultValue={editingCustomer?.address || ''}
                    placeholder="Jl. Contoh No. 123"
                  />
                  <div className="flex gap-4 pt-4">
                    <Button type="button" variant="ghost" onClick={() => setShowCustomerModal(false)} className="flex-1">Batal</Button>
                    <Button type="submit" className="flex-1">Simpan</Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Transaction Modal */}
      <AnimatePresence>
        {showTransactionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowTransactionModal(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto"
            >
              <Card>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">Transaksi Baru</h2>
                  <Button variant="ghost" onClick={() => setShowTransactionModal(false)} className="p-2">
                    <X size={20} />
                  </Button>
                </div>
                <form onSubmit={handleAddTransaction} className="space-y-6">
                  <Select
                    label="Konsumen"
                    name="customer_id"
                    required
                    options={customers.map(c => ({ value: c.id.toString(), label: c.name }))}
                  />

                  <Input
                    label="Tanggal Penjemputan"
                    name="pickup_date"
                    type="datetime-local"
                    required
                  />

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Item</label>
                      <Button type="button" variant="ghost" onClick={addTransactionItem} className="text-sm py-2">
                        <Plus size={16} /> Tambah Item
                      </Button>
                    </div>
                    {newTransactionItems.map((item, index) => (
                      <div key={index} className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10">
                        <div className="flex justify-between items-start mb-4">
                          <span className="text-sm font-bold text-slate-500">Item #{index + 1}</span>
                          {newTransactionItems.length > 1 && (
                            <Button type="button" variant="ghost" onClick={() => removeTransactionItem(index)} className="p-1 text-red-500">
                              <Trash2 size={16} />
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                          <Select
                            label="Jenis"
                            value={item.item_type}
                            onChange={(e: any) => updateTransactionItem(index, 'item_type', e.target.value)}
                            options={[
                              { value: 'shoe', label: 'Sepatu' },
                              { value: 'bag', label: 'Tas' }
                            ]}
                          />
                          <Select
                            label="Layanan"
                            value={item.service_type}
                            onChange={(e: any) => updateTransactionItem(index, 'service_type', e.target.value)}
                            options={[
                              { value: 'Deep Clean', label: 'Deep Clean' },
                              { value: 'Regular Clean', label: 'Regular Clean' },
                              { value: 'Polish', label: 'Polish' },
                              { value: 'Repaint', label: 'Repaint' },
                              { value: 'Repair', label: 'Repair' },
                              { value: 'Whitening', label: 'Whitening' }
                            ]}
                          />
                          <Input 
                            label="Jumlah" 
                            type="number" 
                            value={item.quantity}
                            onChange={(e: any) => updateTransactionItem(index, 'quantity', parseInt(e.target.value))}
                          />
                          <Input 
                            label="Unit" 
                            value={item.unit}
                            onChange={(e: any) => updateTransactionItem(index, 'unit', e.target.value)}
                            placeholder="pasang/pcs"
                          />
                          <Input 
                            label="Harga" 
                            type="number" 
                            value={item.amount}
                            onChange={(e: any) => updateTransactionItem(index, 'amount', parseInt(e.target.value))}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col md:flex-row items-center justify-between gap-8 p-10 rounded-3xl bg-indigo-600 text-white shadow-2xl shadow-indigo-500/20">
                    <div className="space-y-2 text-center md:text-left">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">Total Amount Due</p>
                      <p className="text-5xl font-bold font-display tracking-tighter">
                        Rp {(newTransactionItems.reduce((acc, item) => acc + (item.amount || 0), 0) || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-col gap-6 w-full md:w-auto">
                      <Select 
                        name="status" 
                        label="Initial Status" 
                        defaultValue="proses"
                        className="bg-white/10 border-white/20 text-white focus:ring-white/30"
                        options={[
                          { value: 'proses', label: 'Proses' },
                          { value: 'cicilan', label: 'Cicilan' },
                          { value: 'lunas', label: 'Lunas' }
                        ]}
                      />
                      <div className="flex gap-4">
                        <Button onClick={() => setShowTransactionModal(false)} variant="ghost" className="flex-1 text-white hover:bg-white/10">Cancel</Button>
                        <Button type="submit" variant="secondary" className="flex-1 bg-white text-indigo-600 hover:bg-indigo-50 border-none shadow-xl shadow-black/10">Save & Print</Button>
                      </div>
                    </div>
                  </div>
                </form>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Taken Status Modal */}
      <AnimatePresence>
        {showTakenModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowTakenModal(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md"
            >
              <Card>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-purple-600">Konfirmasi Diambil</h2>
                  <Button variant="ghost" onClick={() => setShowTakenModal(false)} className="p-2">
                    <X size={20} />
                  </Button>
                </div>
                <p className="text-slate-600 dark:text-slate-300 mb-4">Masukkan keterangan jika ada:</p>
                <Input
                  label="Keterangan"
                  value={takenNote}
                  onChange={(e: any) => setTakenNote(e.target.value)}
                  placeholder="Catatan tambahan..."
                />
                <div className="flex gap-4 mt-6">
                  <Button onClick={() => setShowTakenModal(false)} variant="ghost" className="flex-1">Batal</Button>
                  <Button onClick={confirmTakenStatus} className="flex-1 bg-purple-600 hover:bg-purple-700">Simpan</Button>
                </div>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Receipt Modal with QR Code */}
      <AnimatePresence>
        {showReceiptModal && selectedTransaction && (
          <ReceiptModal 
            transaction={selectedTransaction} 
            settings={settings}
            onClose={() => {
              setShowReceiptModal(false);
              setSelectedTransaction(null);
            }}
            onPrint={handlePrintFromModal}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
