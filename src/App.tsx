import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  Receipt, 
  User, 
  Phone, 
  CheckCircle2, 
  XCircle,
  X,
  ShoppingCart,
  ArrowRight,
  Printer,
  QrCode,
  Users,
  MapPin,
  Lock,
  LogOut,
  Edit,
  ChevronDown,
  BarChart3,
  TrendingUp,
  Calendar,
  Package,
  ArrowLeft,
  MessageCircle
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import QRCode from 'qrcode';
import { Product, BillItem, Bill, Customer } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('pos_auth') === 'true';
  });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{id: string, name: string}[]>([]);
  const [cart, setCart] = useState<BillItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discount, setDiscount] = useState(0);
  const [taxRate] = useState(0.05); // 5% GST
  const [isPaying, setIsPaying] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI'>('UPI');
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [lastBill, setLastBill] = useState<Bill | null>(null);
  const [view, setView] = useState<'pos' | 'bills' | 'reports'>('pos');
  const [pastBills, setPastBills] = useState<Bill[]>([]);
  const [billSearchQuery, setBillSearchQuery] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  const [reportsData, setReportsData] = useState<{ bills: any[], products: Product[] } | null>(null);
  const [reportFilters, setReportFilters] = useState({ 
    from: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0], 
    to: new Date().toISOString().split('T')[0] 
  });
  const [isFetchingReports, setIsFetchingReports] = useState(false);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState({ name: '', unitPrice: '', category: '', stock: '0' });

  useEffect(() => {
    if (categories.length > 0 && !newProduct.category) {
      setNewProduct(prev => ({ ...prev, category: categories[0].name }));
    }
  }, [categories]);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isManagingCustomers, setIsManagingCustomers] = useState(false);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', address: '' });
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
      c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
      c.phone.includes(customerSearchQuery)
    );
  }, [customers, customerSearchQuery]);

  const fetchReports = async () => {
    setIsFetchingReports(true);
    try {
      const res = await fetch(`/api/reports?from=${reportFilters.from}&to=${reportFilters.to}`);
      if (res.ok) {
        const data = await res.json();
        setReportsData(data);
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setIsFetchingReports(false);
    }
  };

  useEffect(() => {
    if (view === 'reports') {
      fetchReports();
    }
  }, [view, reportFilters]);
  const fetchProducts = () => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          // Map unit_price to unitPrice for Supabase compatibility
          const mappedData = data.map((p: any) => ({
            ...p,
            unitPrice: p.unitPrice ?? p.unit_price ?? 0
          }));
          setProducts(mappedData);
        }
      })
      .catch(err => console.error('Error fetching products:', err));
  };

  const fetchCustomers = () => {
    fetch('/api/customers')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setCustomers(data);
      })
      .catch(err => console.error('Error fetching customers:', err));
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      if (Array.isArray(data)) setCategories(data);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const fetchBills = () => {
    fetch('/api/bills')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          // Map snake_case to camelCase for Supabase compatibility
          const mappedData = data.map((b: any) => ({
            ...b,
            billId: b.billId ?? b.bill_id ?? '',
            totalAmount: b.totalAmount ?? b.total_amount ?? 0,
            paymentMethod: b.paymentMethod ?? b.payment_method ?? 'UPI',
            paymentStatus: b.paymentStatus ?? b.payment_status ?? 'pending',
            customerName: b.customerName ?? b.customer_name ?? '',
            customerPhone: b.customerPhone ?? b.customer_phone ?? '',
            subtotal: b.subtotal ?? 0,
            tax: b.tax ?? 0,
            discount: b.discount ?? 0
          }));
          setPastBills(mappedData);
        }
      })
      .catch(err => console.error('Error fetching bills:', err));
  };

  useEffect(() => {
    fetchProducts();
    fetchCustomers();
    fetchCategories();
    fetchBills();
  }, []);

  const filteredBills = useMemo(() => {
    return pastBills.filter(bill => 
      (bill.customerName || '').toLowerCase().includes(billSearchQuery.toLowerCase()) ||
      (bill.customerPhone || '').includes(billSearchQuery) ||
      bill.billId.toLowerCase().includes(billSearchQuery.toLowerCase())
    );
  }, [pastBills, billSearchQuery]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           p.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.totalCost, 0);
  }, [cart]);

  const tax = subtotal * taxRate;
  const totalAmount = subtotal + tax - discount;

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => 
          item.productId === product.id 
            ? { ...item, quantity: item.quantity + 1, totalCost: (item.quantity + 1) * item.unitPrice }
            : item
        );
      }
      return [...prev, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: product.unitPrice,
        totalCost: product.unitPrice
      }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty, totalCost: newQty * item.unitPrice };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (!customerPhone || customerPhone.trim() === '') {
      setToast({ message: 'Phone number is mandatory to generate a bill', type: 'error' });
      return;
    }
    setIsPaying(true);
    setPaymentStatus('pending');

    const billId = `BILL-${Date.now()}`;
    
    if (paymentMethod === 'UPI') {
      // User's UPI ID
      const upiId = "8712329978@ybl"; 
      const upiUrl = `upi://pay?pa=${upiId}&pn=ClassicPOS&am=${(totalAmount || 0).toFixed(2)}&tr=${billId}&cu=INR`;

      try {
        const qr = await QRCode.toDataURL(upiUrl);
        setQrCodeUrl(qr);
      } catch (err) {
        console.error('QR generation error:', err);
      }
    } else {
      setPaymentStatus('pending');
    }
  };

  const sendWhatsAppReceipt = (bill: Bill) => {
    if (!bill.customerPhone) {
      setToast({ message: 'No phone number provided for this bill', type: 'error' });
      return;
    }
    
    const itemsText = bill.items.map(item => 
      `${item.productName} x ${item.quantity} = ₹${(item.totalCost || 0).toFixed(2)}`
    ).join('\n');
    
    const message = `*ClassicPOS Receipt*\n\n` +
      `*Bill ID:* ${bill.billId}\n` +
      `*Date:* ${new Date(bill.timestamp).toLocaleString()}\n` +
      `*Customer:* ${bill.customerName || 'Walk-in'}\n\n` +
      `*Items:*\n${itemsText}\n\n` +
      `*Total Amount: ₹${(bill.totalAmount || 0).toFixed(2)}*\n\n` +
      `Thank you for shopping with us!`;
    
    const encodedMessage = encodeURIComponent(message);
    const cleanPhone = bill.customerPhone.replace(/\D/g, '');
    // Add country code if missing (assuming India +91 if 10 digits)
    const phone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const whatsappUrl = `https://wa.me/${phone}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  const confirmPayment = async () => {
    const bill: Bill = {
      billId: `BILL-${Date.now()}`,
      items: cart,
      subtotal,
      tax,
      discount,
      totalAmount,
      timestamp: new Date().toISOString(),
      paymentStatus: 'completed',
      paymentMethod,
      customerName,
      customerPhone
    };

    try {
      const res = await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bill)
      });
      if (res.ok) {
        setPaymentStatus('success');
        setLastBill(bill);
        setCart([]);
        setCustomerName('');
        setCustomerPhone('');
        setDiscount(0);
        fetchBills();
        fetchCustomers();
        fetchProducts(); // Refresh products to update stock
        // Show receipt after a short delay
        setTimeout(() => {
          setShowReceipt(true);
          setIsPaying(false);
          setPaymentStatus('idle');
          setQrCodeUrl('');
        }, 1500);
      } else {
        setPaymentStatus('failed');
      }
    } catch (err) {
      setPaymentStatus('failed');
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const productData = {
      id: `p${Date.now()}`,
      name: newProduct.name,
      unitPrice: Number(newProduct.unitPrice),
      category: newProduct.category,
      stock: Number(newProduct.stock)
    };

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
      });
      if (res.ok) {
        fetchProducts();
        setIsAddingProduct(false);
        setNewProduct({ name: '', unitPrice: '', category: categories[0]?.name || '' });
        setToast({ message: 'Product added successfully', type: 'success' });
      } else {
        const errorData = await res.json();
        setToast({ message: errorData.error || 'Failed to add product', type: 'error' });
      }
    } catch (err) {
      console.error('Error adding product:', err);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) fetchProducts();
    } catch (err) {
      console.error('Error deleting product:', err);
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    
    try {
      const res = await fetch(`/api/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingProduct.name,
          unitPrice: Number(editingProduct.unitPrice),
          category: editingProduct.category,
          stock: Number(editingProduct.stock)
        })
      });
      if (res.ok) {
        fetchProducts();
        setIsEditingProduct(false);
        setEditingProduct(null);
        setToast({ message: 'Product updated successfully', type: 'success' });
      } else {
        const errorData = await res.json();
        setToast({ message: errorData.error || 'Failed to update product', type: 'error' });
      }
    } catch (err) {
      console.error('Error updating product:', err);
      setToast({ message: 'Error updating product', type: 'error' });
    }
  };

  const handleAddCategory = async (name: string) => {
    const id = `c${Date.now()}`;
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name })
      });
      
      if (res.ok) {
        await fetchCategories();
        // Automatically select the new category in the current form
        if (isAddingProduct) {
          setNewProduct(prev => ({ ...prev, category: name }));
        } else if (isEditingProduct && editingProduct) {
          setEditingProduct(prev => prev ? ({ ...prev, category: name }) : null);
        }
        setToast({ message: 'Category added successfully', type: 'success' });
        return true;
      } else {
        const errorData = await res.json();
        setToast({ message: errorData.error || 'Failed to add category', type: 'error' });
        return false;
      }
    } catch (err) {
      console.error('Error adding category:', err);
      setToast({ message: 'Error adding category', type: 'error' });
      return false;
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchCategories();
        if (selectedCategory !== 'All') setSelectedCategory('All');
      }
    } catch (err) {
      console.error('Error deleting category:', err);
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const customerData = {
      id: `c${Date.now()}`,
      ...newCustomer
    };

    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerData)
      });
      if (res.ok) {
        fetchCustomers();
        setIsAddingCustomer(false);
        setNewCustomer({ name: '', phone: '', address: '' });
      }
    } catch (err) {
      console.error('Error adding customer:', err);
    }
  };

  const selectCustomer = (customer: Customer) => {
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone);
    setIsManagingCustomers(false);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      (loginForm.username === 'admin' && loginForm.password === 'admin123') ||
      (loginForm.username === 'pos user' && loginForm.password === '123')
    ) {
      setIsAuthenticated(true);
      localStorage.setItem('pos_auth', 'true');
      setLoginError('');
    } else {
      setLoginError('Invalid username or password');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('pos_auth');
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-10 border border-[#D2D2D7]"
        >
          <div className="text-center mb-10">
            <div className="bg-[#0071E3] w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#0071E3]/20">
              <ShoppingCart className="text-white w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">ClassicPOS Admin</h1>
            <p className="text-[#86868B] mt-2">Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-[#1D1D1F] mb-2 ml-1">Username</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[#86868B] w-5 h-5" />
                <input 
                  required
                  type="text" 
                  className="w-full pl-12 pr-4 py-4 bg-[#F5F5F7] border-none rounded-2xl text-base outline-none focus:ring-2 focus:ring-[#0071E3] transition-all"
                  placeholder="admin"
                  value={loginForm.username || ''}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#1D1D1F] mb-2 ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#86868B] w-5 h-5" />
                <input 
                  required
                  type="password" 
                  className="w-full pl-12 pr-4 py-4 bg-[#F5F5F7] border-none rounded-2xl text-base outline-none focus:ring-2 focus:ring-[#0071E3] transition-all"
                  placeholder="••••••••"
                  value={loginForm.password || ''}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                />
              </div>
            </div>

            {loginError && (
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-red-500 text-sm font-medium text-center"
              >
                {loginError}
              </motion.p>
            )}

            <button 
              type="submit"
              className="w-full bg-[#0071E3] text-white py-4 rounded-2xl font-bold text-lg hover:bg-[#0077ED] transition-all shadow-lg shadow-[#0071E3]/20 active:scale-[0.98]"
            >
              Sign In
            </button>
          </form>

        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] font-sans flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-[#D2D2D7] px-4 md:px-6 py-3 md:py-4 flex flex-col md:flex-row justify-between items-center sticky top-0 z-30 gap-4">
        <div className="flex items-center justify-between w-full md:w-auto gap-6">
          <div className="flex items-center gap-2">
            <div className="bg-[#0071E3] p-1.5 md:p-2 rounded-lg">
              <ShoppingCart className="text-white w-5 h-5 md:w-6 md:h-6" />
            </div>
            <h1 className="text-lg md:text-xl font-semibold tracking-tight">ClassicPOS</h1>
          </div>
          
          <nav className="flex items-center bg-[#F5F5F7] p-1 rounded-xl">
            <button 
              onClick={() => setView('pos')}
              className={cn(
                "px-3 md:px-4 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-all",
                view === 'pos' ? "bg-white shadow-sm text-[#0071E3]" : "text-[#86868B] hover:text-[#1D1D1F]"
              )}
            >
              POS
            </button>
            <button 
              onClick={() => setView('bills')}
              className={cn(
                "px-3 md:px-4 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-all",
                view === 'bills' ? "bg-white shadow-sm text-[#0071E3]" : "text-[#86868B] hover:text-[#1D1D1F]"
              )}
            >
              Bills
            </button>
            <button 
              onClick={() => setView('reports')}
              className={cn(
                "px-3 md:px-4 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-all",
                view === 'reports' ? "bg-white shadow-sm text-[#0071E3]" : "text-[#86868B] hover:text-[#1D1D1F]"
              )}
            >
              Reports
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto overflow-x-auto no-scrollbar pb-1 md:pb-0">
          <button 
            onClick={() => setIsManagingCustomers(true)}
            className="flex items-center gap-2 bg-[#F5F5F7] hover:bg-[#E8E8ED] px-3 md:px-4 py-2 rounded-full text-xs md:text-sm font-medium transition-colors whitespace-nowrap"
          >
            <Users className="w-4 h-4" /> <span className="hidden sm:inline">Customers</span>
          </button>
          <button 
            onClick={() => setIsAddingProduct(true)}
            className="flex items-center gap-2 bg-[#F5F5F7] hover:bg-[#E8E8ED] px-3 md:px-4 py-2 rounded-full text-xs md:text-sm font-medium transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Product</span>
          </button>
          <div className="relative flex-1 md:flex-none min-w-[150px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868B] w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search..." 
              className="pl-10 pr-4 py-2 bg-[#F5F5F7] border-none rounded-full text-xs md:text-sm w-full md:w-48 lg:w-64 focus:ring-2 focus:ring-[#0071E3] transition-all outline-none"
              value={searchQuery || ''}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="hidden md:block h-8 w-[1px] bg-[#D2D2D7]" />
          <div className="hidden md:block text-right">
            <p className="text-xs text-[#86868B]">Register #01</p>
            <p className="text-sm font-medium">Main Counter</p>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 hover:bg-[#F5F5F7] rounded-full text-[#86868B] hover:text-red-500 transition-all ml-auto"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        {view === 'pos' && (
          <>
            {/* Product Grid */}
            <section className="flex-1 p-4 md:p-6 overflow-y-auto pb-24 md:pb-6">
          <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-xl md:text-2xl font-bold">Products</h2>
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar items-center w-full sm:w-auto">
              <button 
                onClick={() => setSelectedCategory('All')}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs md:text-sm border transition-all whitespace-nowrap",
                  selectedCategory === 'All' 
                    ? "bg-[#0071E3] text-white border-[#0071E3]" 
                    : "bg-white text-[#1D1D1F] border-[#D2D2D7] hover:bg-[#F5F5F7]"
                )}
              >
                All
              </button>
              {Array.isArray(categories) && categories.map(cat => (
                <div key={cat.id} className="flex items-center gap-1 group/cat">
                  <button 
                    onClick={() => setSelectedCategory(cat.name)}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-xs md:text-sm border transition-all whitespace-nowrap",
                      selectedCategory === cat.name 
                        ? "bg-[#0071E3] text-white border-[#0071E3]" 
                        : "bg-white text-[#1D1D1F] border-[#D2D2D7] hover:bg-[#F5F5F7]"
                    )}
                  >
                    {cat.name}
                  </button>
                  <button 
                    onClick={() => handleDeleteCategory(cat.id)}
                    className="opacity-0 group-hover/cat:opacity-100 p-1 text-red-500 hover:bg-red-50 rounded-full transition-all"
                    title="Delete Category"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button 
                onClick={() => setIsAddingCategory(true)}
                className="p-1.5 bg-white border border-[#D2D2D7] rounded-full hover:bg-[#F5F5F7] transition-all shrink-0"
                title="Add Category"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
            {filteredProducts.map(product => (
              <motion.div
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.98 }}
                key={product.id}
                onClick={() => addToCart(product)}
                className="bg-white p-3 md:p-4 rounded-2xl border border-[#D2D2D7] text-left flex flex-col justify-between hover:shadow-lg transition-all group cursor-pointer"
              >
                <div>
                  <span className="text-[9px] md:text-[10px] uppercase tracking-wider text-[#86868B] font-semibold">{product.category}</span>
                  <h3 className="font-semibold text-sm md:text-lg mt-1 group-hover:text-[#0071E3] transition-colors line-clamp-2">{product.name}</h3>
                </div>
                  <div className="mt-3 md:mt-4 flex justify-between items-end">
                    <p className="text-lg md:text-xl font-bold">₹{product.unitPrice}</p>
                    <div className="flex gap-1 md:gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingProduct(product);
                          setIsEditingProduct(true);
                        }}
                        className="p-1.5 md:p-2 text-[#0071E3] hover:bg-blue-50 rounded-full transition-all"
                      >
                        <Edit className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProduct(product.id);
                        }}
                        className="p-1.5 md:p-2 text-red-500 hover:bg-red-50 rounded-full transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      </button>
                      <div className="bg-[#F5F5F7] p-1.5 md:p-2 rounded-full group-hover:bg-[#0071E3] group-hover:text-white transition-colors">
                        <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      </div>
                    </div>
                  </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Mobile Cart Overlay */}
        {isCartOpen && (
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setIsCartOpen(false)}
          />
        )}

        {/* Billing Sidebar (Adjustable Tab) */}
        <aside className={cn(
          "fixed inset-y-0 right-0 w-full sm:w-[400px] bg-white border-l border-[#D2D2D7] flex flex-col shadow-2xl z-50 transition-transform duration-300 md:relative md:translate-x-0 md:z-20 md:shadow-none",
          isCartOpen ? "translate-x-0" : "translate-x-full"
        )}>
          <div className="p-4 md:p-6 border-b border-[#D2D2D7] flex justify-between items-center">
            <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
              <Receipt className="w-5 h-5" /> Current Bill
            </h2>
            <button 
              onClick={() => setIsCartOpen(false)}
              className="md:hidden p-2 hover:bg-[#F5F5F7] rounded-full"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="p-4 md:p-6 border-b border-[#D2D2D7]">
            <div className="space-y-3">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868B] w-4 h-4" />
                <input 
                  type="text" 
                  placeholder="Customer Name" 
                  className="w-full pl-10 pr-4 py-2 bg-[#F5F5F7] border-none rounded-xl text-sm outline-none focus:ring-1 focus:ring-[#0071E3]"
                  value={customerName || ''}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868B] w-4 h-4" />
                <input 
                  type="text" 
                  placeholder="Phone Number" 
                  className="w-full pl-10 pr-4 py-2 bg-[#F5F5F7] border-none rounded-xl text-sm outline-none focus:ring-1 focus:ring-[#0071E3]"
                  value={customerPhone || ''}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[#86868B] opacity-50">
                <ShoppingCart className="w-12 h-12 mb-2" />
                <p>Your cart is empty</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.productId} className="flex justify-between items-start group">
                  <div className="flex-1">
                    <h4 className="font-medium">{item.productName}</h4>
                    <p className="text-xs text-[#86868B]">₹{item.unitPrice} × {item.quantity}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <p className="font-semibold">₹{item.totalCost}</p>
                    <div className="flex items-center gap-2 bg-[#F5F5F7] rounded-lg p-1">
                      <button onClick={() => updateQuantity(item.productId, -1)} className="p-1 hover:bg-white rounded transition-colors">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.productId, 1)} className="p-1 hover:bg-white rounded transition-colors">
                        <Plus className="w-3 h-3" />
                      </button>
                      <button onClick={() => removeFromCart(item.productId)} className="p-1 hover:text-red-500 rounded transition-colors ml-1">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-6 bg-[#F5F5F7] border-t border-[#D2D2D7] space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-[#86868B]">Subtotal</span>
              <span>₹{(subtotal || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#86868B]">Tax (5%)</span>
              <span>₹{(tax || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-[#86868B]">Discount</span>
              <input 
                type="number" 
                className="w-20 text-right bg-transparent border-b border-[#D2D2D7] focus:border-[#0071E3] outline-none"
                value={discount || 0}
                onChange={(e) => setDiscount(Number(e.target.value))}
              />
            </div>
            <div className="pt-3 border-t border-[#D2D2D7] space-y-4">
              <div className="flex flex-col gap-2">
                <p className="text-xs text-[#86868B] font-semibold uppercase tracking-wider">Payment Method</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['Cash', 'UPI'] as const).map((method) => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={cn(
                        "py-2 rounded-xl text-xs font-semibold border transition-all",
                        paymentMethod === method
                          ? "bg-[#0071E3] text-white border-[#0071E3]"
                          : "bg-white text-[#1D1D1F] border-[#D2D2D7] hover:bg-[#F5F5F7]"
                      )}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs text-[#86868B] font-semibold uppercase tracking-wider">Total Amount</p>
                  <p className="text-3xl font-bold">₹{(totalAmount || 0).toFixed(2)}</p>
                </div>
                <button 
                  disabled={cart.length === 0}
                  onClick={handleCheckout}
                  className="bg-[#0071E3] text-white px-6 py-3 rounded-2xl font-semibold flex items-center gap-2 hover:bg-[#0077ED] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#0071E3]/20"
                >
                  Checkout <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </aside>
        </>
        )}

        {view === 'bills' && (
          <section className="flex-1 p-8 overflow-y-auto bg-[#F5F5F7]">
            <div className="max-w-5xl mx-auto">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                  <h2 className="text-3xl font-bold">Past Bills</h2>
                  <p className="text-[#86868B] text-sm mt-1">Review and manage your transaction history</p>
                </div>
                
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="relative flex-1 md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868B] w-4 h-4" />
                    <input 
                      type="text" 
                      placeholder="Search customer or bill ID..." 
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#D2D2D7] rounded-xl text-sm focus:ring-2 focus:ring-[#0071E3] transition-all outline-none shadow-sm"
                      value={billSearchQuery || ''}
                      onChange={(e) => setBillSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="bg-white px-4 py-2.5 rounded-xl border border-[#D2D2D7] text-sm font-medium shadow-sm whitespace-nowrap">
                    Total: {pastBills.length}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[2rem] border border-[#D2D2D7] overflow-hidden shadow-sm">
                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full text-left border-collapse min-w-[800px] md:min-w-0">
                    <thead>
                      <tr className="bg-[#F5F5F7] border-b border-[#D2D2D7]">
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#86868B]">Bill ID</th>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#86868B]">Customer</th>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#86868B]">Date & Time</th>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#86868B]">Method</th>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#86868B] text-right">Amount</th>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#86868B] text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D2D2D7]">
                    {filteredBills.map((bill) => (
                      <tr key={bill.billId} className="hover:bg-[#F5F5F7]/50 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs">{bill.billId}</td>
                        <td className="px-6 py-4">
                          <div className="font-medium">{bill.customerName || 'Walk-in'}</div>
                          <div className="text-xs text-[#86868B]">{bill.customerPhone || '-'}</div>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {new Date(bill.timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                            bill.paymentMethod === 'UPI' ? "bg-blue-50 text-blue-600" : "bg-green-50 text-green-600"
                          )}>
                            {bill.paymentMethod}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-bold">
                          ₹{(bill.totalAmount || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button 
                              onClick={() => {
                                setLastBill(bill);
                                setShowReceipt(true);
                              }}
                              className="p-2 hover:bg-[#0071E3] hover:text-white rounded-full transition-all text-[#0071E3]"
                              title="View Receipt"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => sendWhatsAppReceipt(bill)}
                              className="p-2 hover:bg-[#25D366] hover:text-white rounded-full transition-all text-[#25D366]"
                              title="Send via WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredBills.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-[#86868B]">
                          No bills found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
        )}

        {view === 'reports' && (
          <section className="flex-1 p-8 overflow-y-auto bg-[#F5F5F7]">
            <div className="max-w-6xl mx-auto">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                  <h2 className="text-3xl font-bold">Inventory & Sales Reports</h2>
                  <p className="text-[#86868B] text-sm mt-1">Comprehensive data analysis and stock monitoring</p>
                </div>
                
                <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-[#D2D2D7] shadow-sm">
                  <div className="flex items-center gap-2 px-3 border-r border-[#D2D2D7]">
                    <Calendar className="w-4 h-4 text-[#86868B]" />
                    <input 
                      type="date" 
                      className="text-sm outline-none bg-transparent"
                      value={reportFilters.from}
                      onChange={(e) => setReportFilters({ ...reportFilters, from: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-2 px-3">
                    <input 
                      type="date" 
                      className="text-sm outline-none bg-transparent"
                      value={reportFilters.to}
                      onChange={(e) => setReportFilters({ ...reportFilters, to: e.target.value })}
                    />
                  </div>
                  <button 
                    onClick={fetchReports}
                    disabled={isFetchingReports}
                    className="bg-[#0071E3] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#0077ED] transition-all disabled:opacity-50"
                  >
                    {isFetchingReports ? 'Loading...' : 'Update'}
                  </button>
                </div>
              </div>

              {reportsData ? (
                <div className="space-y-8">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                      { 
                        label: 'Total Sales', 
                        value: `₹${reportsData.bills.reduce((sum, b) => sum + b.total_amount, 0).toFixed(2)}`,
                        icon: TrendingUp,
                        color: 'text-green-500',
                        bg: 'bg-green-50'
                      },
                      { 
                        label: 'Total Orders', 
                        value: reportsData.bills.length,
                        icon: ShoppingCart,
                        color: 'text-blue-500',
                        bg: 'bg-blue-50'
                      },
                      { 
                        label: 'Avg. Order Value', 
                        value: `₹${(reportsData.bills.length > 0 ? reportsData.bills.reduce((sum, b) => sum + b.total_amount, 0) / reportsData.bills.length : 0).toFixed(2)}`,
                        icon: CreditCard,
                        color: 'text-purple-500',
                        bg: 'bg-purple-50'
                      },
                      { 
                        label: 'Low Stock Items', 
                        value: reportsData.products.filter(p => p.stock < 10).length,
                        icon: Package,
                        color: 'text-orange-500',
                        bg: 'bg-orange-50'
                      }
                    ].map((stat, i) => (
                      <div key={i} className="bg-white p-6 rounded-[2rem] border border-[#D2D2D7] shadow-sm">
                        <div className="flex items-center gap-4">
                          <div className={cn("p-3 rounded-2xl", stat.bg)}>
                            <stat.icon className={cn("w-6 h-6", stat.color)} />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-[#86868B] uppercase tracking-wider">{stat.label}</p>
                            <p className="text-2xl font-bold mt-1">{stat.value}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Charts Section */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Sales Trend */}
                    <div className="bg-white p-8 rounded-[2rem] border border-[#D2D2D7] shadow-sm">
                      <h3 className="text-xl font-bold mb-6">Sales Trend</h3>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={
                            Object.entries(
                              reportsData.bills.reduce((acc: any, b) => {
                                const date = new Date(b.timestamp).toLocaleDateString();
                                acc[date] = (acc[date] || 0) + b.total_amount;
                                return acc;
                              }, {})
                            ).map(([date, amount]) => ({ date, amount }))
                          }>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F5F5F7" />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#86868B' }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#86868B' }} />
                            <Tooltip 
                              contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                            />
                            <Bar dataKey="amount" fill="#0071E3" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Sales by Category */}
                    <div className="bg-white p-8 rounded-[2rem] border border-[#D2D2D7] shadow-sm">
                      <h3 className="text-xl font-bold mb-6">Sales by Category</h3>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={
                                Object.entries(
                                  reportsData.bills.reduce((acc: any, b) => {
                                    b.bill_items?.forEach((item: any) => {
                                      const product = reportsData.products.find(p => p.id === item.product_id || p.id === item.productId);
                                      const cat = product?.category || 'Uncategorized';
                                      acc[cat] = (acc[cat] || 0) + item.total_cost || item.totalCost || 0;
                                    });
                                    return acc;
                                  }, {})
                                ).map(([name, value]) => ({ name, value }))
                              }
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {['#0071E3', '#34C759', '#FF9500', '#FF3B30', '#AF52DE', '#5856D6'].map((color, index) => (
                                <Cell key={`cell-${index}`} fill={color} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                            />
                            <Legend verticalAlign="bottom" height={36}/>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Detailed Tables */}
                  <div className="grid grid-cols-1 gap-8">
                    {/* Consumption Details */}
                    <div className="bg-white rounded-[2rem] border border-[#D2D2D7] overflow-hidden shadow-sm">
                      <div className="p-6 border-b border-[#D2D2D7] bg-[#F5F5F7]">
                        <h3 className="font-bold">Consumption Details (Top Products)</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-white border-b border-[#D2D2D7]">
                              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#86868B]">Product</th>
                              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#86868B]">Category</th>
                              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#86868B] text-center">Qty Sold</th>
                              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#86868B] text-right">Revenue</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#D2D2D7]">
                            {Object.entries(
                              reportsData.bills.reduce((acc: any, b) => {
                                b.bill_items?.forEach((item: any) => {
                                  const id = item.product_id || item.productId;
                                  if (!acc[id]) {
                                    const product = reportsData.products.find(p => p.id === id);
                                    acc[id] = { 
                                      name: item.product_name || item.productName, 
                                      category: product?.category || 'Uncategorized',
                                      qty: 0, 
                                      revenue: 0 
                                    };
                                  }
                                  acc[id].qty += item.quantity;
                                  acc[id].revenue += item.total_cost || item.totalCost || 0;
                                });
                                return acc;
                              }, {})
                            )
                            .sort((a: any, b: any) => b[1].revenue - a[1].revenue)
                            .slice(0, 10)
                            .map(([id, data]: [string, any]) => (
                              <tr key={id} className="hover:bg-[#F5F5F7]/50 transition-colors">
                                <td className="px-6 py-4 font-medium">{data.name}</td>
                                <td className="px-6 py-4 text-sm text-[#86868B]">{data.category}</td>
                                <td className="px-6 py-4 text-center font-semibold">{data.qty}</td>
                                <td className="px-6 py-4 text-right font-bold">₹{data.revenue.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Stock Details */}
                    <div className="bg-white rounded-[2rem] border border-[#D2D2D7] overflow-hidden shadow-sm">
                      <div className="p-6 border-b border-[#D2D2D7] bg-[#F5F5F7]">
                        <h3 className="font-bold">Inventory & Stock Status</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-white border-b border-[#D2D2D7]">
                              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#86868B]">Product</th>
                              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#86868B]">Category</th>
                              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#86868B] text-center">Current Stock</th>
                              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[#86868B] text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#D2D2D7]">
                            {reportsData.products.map((product) => (
                              <tr key={product.id} className="hover:bg-[#F5F5F7]/50 transition-colors">
                                <td className="px-6 py-4 font-medium">{product.name}</td>
                                <td className="px-6 py-4 text-sm text-[#86868B]">{product.category}</td>
                                <td className="px-6 py-4 text-center font-bold">{product.stock}</td>
                                <td className="px-6 py-4 text-center">
                                  <span className={cn(
                                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase",
                                    product.stock === 0 ? "bg-red-50 text-red-600" : 
                                    product.stock < 10 ? "bg-orange-50 text-orange-600" : 
                                    "bg-green-50 text-green-600"
                                  )}>
                                    {product.stock === 0 ? 'Out of Stock' : product.stock < 10 ? 'Low Stock' : 'In Stock'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-20 text-center bg-white rounded-[2rem] border border-[#D2D2D7]">
                  <BarChart3 className="w-16 h-16 text-[#D2D2D7] mx-auto mb-4" />
                  <h3 className="text-xl font-bold">No report data available</h3>
                  <p className="text-[#86868B]">Select a date range and click update to generate reports.</p>
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {/* Mobile Cart Toggle Bar */}
      {view === 'pos' && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#D2D2D7] p-4 z-30 flex items-center justify-between shadow-lg">
          <div className="flex flex-col">
            <span className="text-xs text-[#86868B] uppercase tracking-wider font-semibold">Total Amount</span>
            <span className="text-xl font-bold text-[#0071E3]">₹{(totalAmount || 0).toFixed(2)}</span>
          </div>
          <button 
            onClick={() => setIsCartOpen(true)}
            className="bg-[#0071E3] text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-[#0071E3]/20 active:scale-[0.98] transition-all"
          >
            <ShoppingCart className="w-5 h-5" />
            View Cart ({cart.length})
          </button>
        </div>
      )}

      {/* Payment Modal */}
      <AnimatePresence>
        {isPaying && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsPaying(false);
                setQrCodeUrl('');
              }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <div className="p-8 text-center">
                {paymentStatus === 'pending' && (
                  <>
                    <div className="flex justify-center mb-6">
                      <div className="bg-[#F5F5F7] p-4 rounded-3xl">
                        {paymentMethod === 'UPI' ? (
                          <QrCode className="w-12 h-12 text-[#0071E3]" />
                        ) : (
                          <Receipt className="w-12 h-12 text-[#0071E3]" />
                        )}
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold mb-2">
                      {paymentMethod === 'UPI' ? 'Scan to Pay' : 'Cash Payment'}
                    </h3>
                    <p className="text-[#86868B] mb-8">
                      {paymentMethod === 'UPI' ? `Please scan the QR code using any UPI app to pay ₹${(totalAmount || 0).toFixed(2)}` :
                       `Collect ₹${(totalAmount || 0).toFixed(2)} in cash from the customer`}
                    </p>
                    
                    {paymentMethod === 'UPI' && (
                      <div className="bg-white p-4 border-2 border-[#F5F5F7] rounded-3xl inline-block mb-8">
                        {qrCodeUrl && <img src={qrCodeUrl} alt="UPI QR Code" className="w-48 h-48" />}
                      </div>
                    )}

                    <div className="space-y-3">
                      <button 
                        onClick={confirmPayment}
                        className="w-full bg-[#0071E3] text-white py-4 rounded-2xl font-bold hover:bg-[#0077ED] transition-all"
                      >
                        Confirm Payment Received
                      </button>
                      <button 
                        onClick={() => {
                          setIsPaying(false);
                          setQrCodeUrl('');
                        }}
                        className="w-full text-[#0071E3] py-2 font-semibold"
                      >
                        Cancel Transaction
                      </button>
                    </div>
                  </>
                )}

                {paymentStatus === 'success' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="py-12"
                  >
                    <div className="flex justify-center mb-6">
                      <div className="bg-green-100 p-6 rounded-full">
                        <CheckCircle2 className="w-16 h-16 text-green-500" />
                      </div>
                    </div>
                    <h3 className="text-3xl font-bold mb-2">Payment Successful</h3>
                    <p className="text-[#86868B] mb-8">Transaction ID: {lastBill?.billId}</p>
                    <div className="flex justify-center gap-4">
                      <button 
                        onClick={() => window.print()}
                        className="flex items-center gap-2 px-6 py-3 bg-[#F5F5F7] rounded-xl font-semibold hover:bg-[#E8E8ED] transition-all"
                      >
                        <Printer className="w-4 h-4" /> Print Receipt
                      </button>
                      {lastBill && (
                        <button 
                          onClick={() => sendWhatsAppReceipt(lastBill)}
                          className="flex items-center gap-2 px-6 py-3 bg-[#25D366] text-white rounded-xl font-semibold hover:bg-[#128C7E] transition-all"
                        >
                          <MessageCircle className="w-4 h-4" /> WhatsApp
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}

                {paymentStatus === 'failed' && (
                  <div className="py-12 text-center">
                    <div className="flex justify-center mb-6">
                      <div className="bg-red-100 p-6 rounded-full">
                        <XCircle className="w-16 h-16 text-red-500" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold mb-2">Payment Failed</h3>
                    <p className="text-[#86868B] mb-8">Something went wrong with the transaction.</p>
                    <button 
                      onClick={() => setPaymentStatus('pending')}
                      className="bg-[#0071E3] text-white px-8 py-3 rounded-xl font-bold"
                    >
                      Try Again
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Category Modal */}
      <AnimatePresence>
        {isAddingCategory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingCategory(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <div className="p-8">
                <h3 className="text-2xl font-bold mb-6">Add New Category</h3>
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (newCategoryName.trim()) {
                      const success = await handleAddCategory(newCategoryName.trim());
                      if (success) {
                        setNewCategoryName('');
                        setIsAddingCategory(false);
                      }
                    }
                  }} 
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-[#86868B] mb-1">Category Name</label>
                    <input 
                      required
                      autoFocus
                      type="text" 
                      className="w-full px-4 py-3 bg-[#F5F5F7] border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#0071E3]"
                      placeholder="e.g. Snacks, Desserts..."
                      value={newCategoryName || ''}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                    />
                  </div>
                  <div className="pt-4 flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setIsAddingCategory(false)}
                      className="flex-1 px-6 py-3 rounded-xl font-semibold bg-[#F5F5F7] hover:bg-[#E8E8ED] transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 px-6 py-3 rounded-xl font-semibold bg-[#0071E3] text-white hover:bg-[#0077ED] transition-all"
                    >
                      Add Category
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Product Modal */}
      <AnimatePresence>
        {isAddingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingProduct(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <div className="p-8">
                <h3 className="text-2xl font-bold mb-6">Add New Product</h3>
                <form onSubmit={handleAddProduct} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#86868B] mb-1">Product Name</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-3 bg-[#F5F5F7] border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#0071E3]"
                      value={newProduct.name || ''}
                      onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#86868B] mb-1">Unit Price (₹)</label>
                    <input 
                      required
                      type="number" 
                      className="w-full px-4 py-3 bg-[#F5F5F7] border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#0071E3]"
                      value={newProduct.unitPrice || ''}
                      onChange={(e) => setNewProduct({ ...newProduct, unitPrice: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#86868B] mb-1">Category</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <select 
                          className="w-full px-4 py-3 bg-[#F5F5F7] border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#0071E3] appearance-none"
                          value={newProduct.category || ''}
                          onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                        >
                          {Array.isArray(categories) && categories.map(cat => (
                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                          ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#86868B]">
                          <ChevronDown className="w-4 h-4" />
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setIsAddingCategory(true)}
                        className="p-3 bg-[#F5F5F7] text-[#0071E3] rounded-xl hover:bg-blue-50 transition-all"
                        title="Add Category"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#86868B] mb-1">Initial Stock</label>
                    <input 
                      required
                      type="number" 
                      className="w-full px-4 py-3 bg-[#F5F5F7] border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#0071E3]"
                      value={newProduct.stock || '0'}
                      onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                    />
                  </div>
                  <div className="pt-4 flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setIsAddingProduct(false)}
                      className="flex-1 px-6 py-3 rounded-xl font-semibold bg-[#F5F5F7] hover:bg-[#E8E8ED] transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 px-6 py-3 rounded-xl font-semibold bg-[#0071E3] text-white hover:bg-[#0077ED] transition-all"
                    >
                      Add Product
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Product Modal */}
      <AnimatePresence>
        {isEditingProduct && editingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsEditingProduct(false);
                setEditingProduct(null);
              }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <div className="p-8">
                <h3 className="text-2xl font-bold mb-6">Edit Product</h3>
                <form onSubmit={handleUpdateProduct} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#86868B] mb-1">Product Name</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-3 bg-[#F5F5F7] border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#0071E3]"
                      value={editingProduct.name || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#86868B] mb-1">Unit Price (₹)</label>
                    <input 
                      required
                      type="number" 
                      className="w-full px-4 py-3 bg-[#F5F5F7] border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#0071E3]"
                      value={editingProduct.unitPrice || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, unitPrice: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#86868B] mb-1">Category</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <select 
                          className="w-full px-4 py-3 bg-[#F5F5F7] border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#0071E3] appearance-none"
                          value={editingProduct.category || ''}
                          onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                        >
                          {Array.isArray(categories) && categories.map(cat => (
                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                          ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#86868B]">
                          <ChevronDown className="w-4 h-4" />
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setIsAddingCategory(true)}
                        className="p-3 bg-[#F5F5F7] text-[#0071E3] rounded-xl hover:bg-blue-50 transition-all"
                        title="Add Category"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#86868B] mb-1">Stock Level</label>
                    <input 
                      required
                      type="number" 
                      className="w-full px-4 py-3 bg-[#F5F5F7] border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#0071E3]"
                      value={editingProduct.stock || 0}
                      onChange={(e) => setEditingProduct({ ...editingProduct, stock: Number(e.target.value) })}
                    />
                  </div>
                  <div className="pt-4 flex gap-3">
                    <button 
                      type="button"
                      onClick={() => {
                        setIsEditingProduct(false);
                        setEditingProduct(null);
                      }}
                      className="flex-1 px-6 py-3 rounded-xl font-semibold bg-[#F5F5F7] hover:bg-[#E8E8ED] transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 px-6 py-3 rounded-xl font-semibold bg-[#0071E3] text-white hover:bg-[#0077ED] transition-all"
                    >
                      Update Product
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Customer Management Modal */}
      <AnimatePresence>
        {isManagingCustomers && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsManagingCustomers(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-4xl h-[90vh] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-[#D2D2D7] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex flex-col gap-1">
                  <h3 className="text-2xl font-bold">Customer Management</h3>
                  <p className="text-sm text-[#86868B]">Manage and select your customers</p>
                </div>
                
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868B] w-4 h-4" />
                    <input 
                      type="text" 
                      placeholder="Search name or phone..." 
                      className="w-full pl-10 pr-4 py-2 bg-[#F5F5F7] border-none rounded-full text-sm focus:ring-2 focus:ring-[#0071E3] transition-all outline-none"
                      value={customerSearchQuery || ''}
                      onChange={(e) => setCustomerSearchQuery(e.target.value)}
                    />
                  </div>
                  <button 
                    onClick={() => setIsAddingCustomer(true)}
                    className="bg-[#0071E3] text-white px-6 py-2 rounded-full font-semibold hover:bg-[#0077ED] transition-all flex items-center gap-2 whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" /> New Customer
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredCustomers.map(customer => (
                    <motion.div 
                      whileHover={{ y: -4 }}
                      key={customer.id}
                      className="bg-[#F5F5F7] p-6 rounded-2xl border border-[#D2D2D7] flex flex-col justify-between"
                    >
                      <div>
                        <h4 className="font-bold text-lg">{customer.name}</h4>
                        <div className="mt-2 space-y-1 text-sm text-[#86868B]">
                          <p className="flex items-center gap-2"><Phone className="w-3 h-3" /> {customer.phone}</p>
                          {customer.address && <p className="flex items-center gap-2"><MapPin className="w-3 h-3" /> {customer.address}</p>}
                        </div>
                      </div>
                      <button 
                        onClick={() => selectCustomer(customer)}
                        className="mt-6 w-full py-2 bg-white border border-[#D2D2D7] rounded-xl text-sm font-semibold hover:bg-[#0071E3] hover:text-white hover:border-[#0071E3] transition-all"
                      >
                        Select for Bill
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
              
              <div className="p-6 border-t border-[#D2D2D7] flex justify-end">
                <button 
                  onClick={() => setIsManagingCustomers(false)}
                  className="px-6 py-2 bg-[#F5F5F7] rounded-xl font-semibold hover:bg-[#E8E8ED] transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Customer Modal */}
      <AnimatePresence>
        {isAddingCustomer && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingCustomer(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <div className="p-8">
                <h3 className="text-2xl font-bold mb-6">New Customer</h3>
                <form onSubmit={handleAddCustomer} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#86868B] mb-1">Full Name</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-3 bg-[#F5F5F7] border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#0071E3]"
                      value={newCustomer.name || ''}
                      onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#86868B] mb-1">Phone Number</label>
                    <input 
                      required
                      type="tel" 
                      className="w-full px-4 py-3 bg-[#F5F5F7] border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#0071E3]"
                      value={newCustomer.phone || ''}
                      onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#86868B] mb-1">Address (Optional)</label>
                    <textarea 
                      className="w-full px-4 py-3 bg-[#F5F5F7] border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#0071E3] resize-none h-24"
                      value={newCustomer.address || ''}
                      onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                    />
                  </div>
                  <div className="pt-4 flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setIsAddingCustomer(false)}
                      className="flex-1 px-6 py-3 rounded-xl font-semibold bg-[#F5F5F7] hover:bg-[#E8E8ED] transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 px-6 py-3 rounded-xl font-semibold bg-[#0071E3] text-white hover:bg-[#0077ED] transition-all"
                    >
                      Save Customer
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
        {/* Receipt Modal */}
        {showReceipt && lastBill && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowReceipt(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-md"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
              >
                <div className="p-8">
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-[#F5F5F7] rounded-3xl flex items-center justify-center mx-auto mb-4">
                      <Receipt className="w-8 h-8 text-[#0071E3]" />
                    </div>
                    <h2 className="text-2xl font-bold">Payment Successful</h2>
                    <p className="text-[#86868B] text-sm mt-1">Receipt for {lastBill.billId}</p>
                  </div>

                  <div className="space-y-4 border-t border-b border-[#F5F5F7] py-6 mb-6">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#86868B]">Date</span>
                      <span className="font-medium">{new Date(lastBill.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#86868B]">Customer</span>
                      <span className="font-medium">{lastBill.customerName || 'Walk-in'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#86868B]">Payment Mode</span>
                      <span className="font-medium">{lastBill.paymentMethod}</span>
                    </div>
                  </div>

                  <div className="space-y-3 mb-8">
                    {lastBill.items?.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-[#1D1D1F]">{item.productName} <span className="text-[#86868B]">×{item.quantity}</span></span>
                        <span className="font-medium">₹{(item.totalCost || 0).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="pt-3 border-t border-[#F5F5F7] flex justify-between items-center">
                      <span className="text-lg font-bold">Total Paid</span>
                      <span className="text-2xl font-bold text-[#0071E3]">₹{(lastBill.totalAmount || 0).toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <button 
                      onClick={() => window.print()}
                      className="flex items-center justify-center gap-2 bg-[#F5F5F7] text-[#1D1D1F] py-4 rounded-2xl font-bold hover:bg-[#E8E8ED] transition-all"
                    >
                      <Printer className="w-4 h-4" /> Print
                    </button>
                    <button 
                      onClick={() => sendWhatsAppReceipt(lastBill)}
                      className="flex items-center justify-center gap-2 bg-[#25D366] text-white py-4 rounded-2xl font-bold hover:bg-[#128C7E] transition-all"
                    >
                      <MessageCircle className="w-4 h-4" /> WhatsApp
                    </button>
                    <button 
                      onClick={() => setShowReceipt(false)}
                      className="bg-[#0071E3] text-white py-4 rounded-2xl font-bold hover:bg-[#0077ED] transition-all"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        {/* End Receipt Modal */}
      </AnimatePresence>
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={cn(
              "fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-xl text-white font-semibold flex items-center gap-2",
              toast.type === 'success' ? "bg-green-500" : "bg-red-500"
            )}
          >
            {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
