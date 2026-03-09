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
  ShoppingCart,
  ArrowRight,
  Printer,
  QrCode,
  Users,
  Mail,
  MapPin,
  Lock,
  LogOut
} from 'lucide-react';
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
  const [view, setView] = useState<'pos' | 'bills'>('pos');
  const [pastBills, setPastBills] = useState<Bill[]>([]);
  const [billSearchQuery, setBillSearchQuery] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', unitPrice: '', category: 'Dairy' });

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isManagingCustomers, setIsManagingCustomers] = useState(false);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', address: '' });
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
      c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
      c.phone.includes(customerSearchQuery)
    );
  }, [customers, customerSearchQuery]);

  const fetchProducts = () => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => setProducts(data))
      .catch(err => console.error('Error fetching products:', err));
  };

  const fetchCustomers = () => {
    fetch('/api/customers')
      .then(res => res.json())
      .then(data => setCustomers(data))
      .catch(err => console.error('Error fetching customers:', err));
  };

  const fetchCategories = () => {
    fetch('/api/categories')
      .then(res => res.json())
      .then(data => setCategories(data))
      .catch(err => console.error('Error fetching categories:', err));
  };

  const fetchBills = () => {
    fetch('/api/bills')
      .then(res => res.json())
      .then(data => setPastBills(data))
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
    setIsPaying(true);
    setPaymentStatus('pending');

    const billId = `BILL-${Date.now()}`;
    
    if (paymentMethod === 'UPI') {
      const upiId = "merchant@upi"; // Placeholder merchant ID
      const upiUrl = `upi://pay?pa=${upiId}&pn=ClassicPOS&am=${totalAmount.toFixed(2)}&tr=${billId}&cu=INR`;

      try {
        const qr = await QRCode.toDataURL(upiUrl);
        setQrCodeUrl(qr);
      } catch (err) {
        console.error('QR generation error:', err);
      }
    } else {
      // For Cash, we can skip the QR step or show a different confirmation
      setPaymentStatus('pending');
    }
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
        // Show receipt after a short delay
        setTimeout(() => {
          setShowReceipt(true);
          setIsPaying(false);
          setPaymentStatus('idle');
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
      category: newProduct.category
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
        setNewProduct({ name: '', unitPrice: '', category: categories[0]?.name || 'Dairy' });
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

  const handleAddCategory = async (name: string) => {
    const id = `c${Date.now()}`;
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name })
      });
      if (res.ok) fetchCategories();
    } catch (err) {
      console.error('Error adding category:', err);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category? This will not delete products in it, but they will lose their category association.')) return;
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
        setNewCustomer({ name: '', phone: '', email: '', address: '' });
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
    if (loginForm.username === 'admin' && loginForm.password === 'admin123') {
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
                  value={loginForm.username}
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
                  value={loginForm.password}
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
      <header className="bg-white border-b border-[#D2D2D7] px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="bg-[#0071E3] p-2 rounded-lg">
              <ShoppingCart className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">ClassicPOS</h1>
          </div>
          
          <nav className="flex items-center bg-[#F5F5F7] p-1 rounded-xl">
            <button 
              onClick={() => setView('pos')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                view === 'pos' ? "bg-white shadow-sm text-[#0071E3]" : "text-[#86868B] hover:text-[#1D1D1F]"
              )}
            >
              POS
            </button>
            <button 
              onClick={() => setView('bills')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                view === 'bills' ? "bg-white shadow-sm text-[#0071E3]" : "text-[#86868B] hover:text-[#1D1D1F]"
              )}
            >
              Past Bills
            </button>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsManagingCustomers(true)}
            className="flex items-center gap-2 bg-[#F5F5F7] hover:bg-[#E8E8ED] px-4 py-2 rounded-full text-sm font-medium transition-colors"
          >
            <Users className="w-4 h-4" /> Customers
          </button>
          <button 
            onClick={() => setIsAddingProduct(true)}
            className="flex items-center gap-2 bg-[#F5F5F7] hover:bg-[#E8E8ED] px-4 py-2 rounded-full text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Product
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868B] w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search products..." 
              className="pl-10 pr-4 py-2 bg-[#F5F5F7] border-none rounded-full text-sm w-64 focus:ring-2 focus:ring-[#0071E3] transition-all outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="h-8 w-[1px] bg-[#D2D2D7]" />
          <div className="text-right">
            <p className="text-xs text-[#86868B]">Register #01</p>
            <p className="text-sm font-medium">Main Counter</p>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 hover:bg-[#F5F5F7] rounded-full text-[#86868B] hover:text-red-500 transition-all"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {view === 'pos' ? (
          <>
            {/* Product Grid */}
            <section className="flex-1 p-6 overflow-y-auto">
          <div className="mb-6 flex justify-between items-center">
            <h2 className="text-2xl font-bold">Products</h2>
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar items-center">
              <button 
                onClick={() => setSelectedCategory('All')}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm border transition-all whitespace-nowrap",
                  selectedCategory === 'All' 
                    ? "bg-[#0071E3] text-white border-[#0071E3]" 
                    : "bg-white text-[#1D1D1F] border-[#D2D2D7] hover:bg-[#F5F5F7]"
                )}
              >
                All
              </button>
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center gap-1 group/cat">
                  <button 
                    onClick={() => setSelectedCategory(cat.name)}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-sm border transition-all whitespace-nowrap",
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
                className="p-1.5 bg-white border border-[#D2D2D7] rounded-full hover:bg-[#F5F5F7] transition-all"
                title="Add Category"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredProducts.map(product => (
              <motion.div
                whileHover={{ y: -4 }}
                key={product.id}
                onClick={() => addToCart(product)}
                className="bg-white p-4 rounded-2xl border border-[#D2D2D7] text-left flex flex-col justify-between hover:shadow-lg transition-all group cursor-pointer"
              >
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-[#86868B] font-semibold">{product.category}</span>
                  <h3 className="font-semibold text-lg mt-1 group-hover:text-[#0071E3] transition-colors">{product.name}</h3>
                </div>
                <div className="mt-4 flex justify-between items-end">
                  <p className="text-xl font-bold">₹{product.unitPrice}</p>
                  <div className="flex gap-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProduct(product.id);
                      }}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="bg-[#F5F5F7] p-2 rounded-full group-hover:bg-[#0071E3] group-hover:text-white transition-colors">
                      <Plus className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Billing Sidebar */}
        <aside className="w-[400px] bg-white border-l border-[#D2D2D7] flex flex-col shadow-2xl z-20">
          <div className="p-6 border-b border-[#D2D2D7]">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Receipt className="w-5 h-5" /> Current Bill
            </h2>
            
            <div className="mt-4 space-y-3">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868B] w-4 h-4" />
                <input 
                  type="text" 
                  placeholder="Customer Name" 
                  className="w-full pl-10 pr-4 py-2 bg-[#F5F5F7] border-none rounded-xl text-sm outline-none focus:ring-1 focus:ring-[#0071E3]"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868B] w-4 h-4" />
                <input 
                  type="text" 
                  placeholder="Phone Number" 
                  className="w-full pl-10 pr-4 py-2 bg-[#F5F5F7] border-none rounded-xl text-sm outline-none focus:ring-1 focus:ring-[#0071E3]"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
              <span>₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#86868B]">Tax (5%)</span>
              <span>₹{tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-[#86868B]">Discount</span>
              <input 
                type="number" 
                className="w-20 text-right bg-transparent border-b border-[#D2D2D7] focus:border-[#0071E3] outline-none"
                value={discount}
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
                  <p className="text-3xl font-bold">₹{totalAmount.toFixed(2)}</p>
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
        ) : (
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
                      value={billSearchQuery}
                      onChange={(e) => setBillSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="bg-white px-4 py-2.5 rounded-xl border border-[#D2D2D7] text-sm font-medium shadow-sm whitespace-nowrap">
                    Total: {pastBills.length}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[2rem] border border-[#D2D2D7] overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
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
                          ₹{bill.totalAmount.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button 
                            onClick={() => {
                              setLastBill(bill);
                              setShowReceipt(true);
                            }}
                            className="p-2 hover:bg-[#0071E3] hover:text-white rounded-full transition-all text-[#0071E3]"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
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
          </section>
        )}
      </main>

      {/* Payment Modal */}
      <AnimatePresence>
        {isPaying && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPaying(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden"
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
                      {paymentMethod === 'UPI' ? `Please scan the QR code using any UPI app to pay ₹${totalAmount.toFixed(2)}` :
                       `Collect ₹${totalAmount.toFixed(2)} in cash from the customer`}
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
                        onClick={() => setIsPaying(false)}
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
                      <button className="flex items-center gap-2 px-6 py-3 bg-[#F5F5F7] rounded-xl font-semibold hover:bg-[#E8E8ED] transition-all">
                        <Printer className="w-4 h-4" /> Print Receipt
                      </button>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
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
              className="relative bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <h3 className="text-2xl font-bold mb-6">Add New Category</h3>
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newCategoryName.trim()) {
                      handleAddCategory(newCategoryName.trim());
                      setNewCategoryName('');
                      setIsAddingCategory(false);
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
                      value={newCategoryName}
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
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
              className="relative bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden"
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
                      value={newProduct.name}
                      onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#86868B] mb-1">Unit Price (₹)</label>
                    <input 
                      required
                      type="number" 
                      className="w-full px-4 py-3 bg-[#F5F5F7] border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#0071E3]"
                      value={newProduct.unitPrice}
                      onChange={(e) => setNewProduct({ ...newProduct, unitPrice: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#86868B] mb-1">Category</label>
                    <select 
                      className="w-full px-4 py-3 bg-[#F5F5F7] border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#0071E3] appearance-none"
                      value={newProduct.category}
                      onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                    >
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
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

      {/* Customer Management Modal */}
      <AnimatePresence>
        {isManagingCustomers && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
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
              className="relative bg-white w-full max-w-4xl h-[80vh] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col"
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
                      value={customerSearchQuery}
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
                          {customer.email && <p className="flex items-center gap-2"><Mail className="w-3 h-3" /> {customer.email}</p>}
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
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
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
              className="relative bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden"
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
                      value={newCustomer.name}
                      onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#86868B] mb-1">Phone Number</label>
                    <input 
                      required
                      type="tel" 
                      className="w-full px-4 py-3 bg-[#F5F5F7] border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#0071E3]"
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#86868B] mb-1">Email Address (Optional)</label>
                    <input 
                      type="email" 
                      className="w-full px-4 py-3 bg-[#F5F5F7] border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#0071E3]"
                      value={newCustomer.email}
                      onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#86868B] mb-1">Address (Optional)</label>
                    <textarea 
                      className="w-full px-4 py-3 bg-[#F5F5F7] border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#0071E3] resize-none h-24"
                      value={newCustomer.address}
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
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
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
                className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
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
                        <span className="font-medium">₹{item.totalCost.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="pt-3 border-t border-[#F5F5F7] flex justify-between items-center">
                      <span className="text-lg font-bold">Total Paid</span>
                      <span className="text-2xl font-bold text-[#0071E3]">₹{lastBill.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => window.print()}
                      className="flex items-center justify-center gap-2 bg-[#F5F5F7] text-[#1D1D1F] py-4 rounded-2xl font-bold hover:bg-[#E8E8ED] transition-all"
                    >
                      <Printer className="w-4 h-4" /> Print
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
    </div>
  );
}
