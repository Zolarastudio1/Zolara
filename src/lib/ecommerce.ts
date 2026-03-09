import { supabase } from '../integrations/supabase/client';

export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  slug: string;
  parent_category_id?: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  short_description?: string;
  sku?: string;
  price: number;
  sale_price?: number;
  category_id?: string;
  brand?: string;
  weight_grams?: number;
  dimensions?: string;
  stock_quantity: number;
  low_stock_threshold: number;
  is_digital: boolean;
  requires_shipping: boolean;
  is_featured: boolean;
  is_active: boolean;
  images: string[];
  tags: string[];
  meta_title?: string;
  meta_description?: string;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  attribute_type: string;
  price_adjustment: number;
  sku_suffix?: string;
  stock_quantity: number;
  is_default: boolean;
  created_at: string;
}

export interface CartItem {
  id: string;
  client_id: string;
  product_id: string;
  variant_id?: string;
  quantity: number;
  price_per_item: number;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  client_id?: string;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  subtotal: number;
  tax_amount: number;
  shipping_amount: number;
  discount_amount: number;
  total_amount: number;
  promo_code_id?: string;
  payment_method?: string;
  payment_reference?: string;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded' | 'partial';
  shipping_address?: any;
  billing_address?: any;
  notes?: string;
  shipped_at?: string;
  delivered_at?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id?: string;
  variant_id?: string;
  product_name: string;
  variant_name?: string;
  quantity: number;
  price_per_item: number;
  total_price: number;
  created_at: string;
}

export const ecommerceService = {
  // PRODUCT CATEGORIES
  async getAllCategories() {
    const { data, error } = await supabase
      .from('product_categories')
      .select('*')
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });
    
    if (error) throw error;
    return data as ProductCategory[];
  },

  async getActiveCategories() {
    const { data, error } = await supabase
      .from('product_categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    
    if (error) throw error;
    return data as ProductCategory[];
  },

  async createCategory(category: Omit<ProductCategory, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('product_categories')
      .insert([category])
      .select()
      .single();
    
    if (error) throw error;
    return data as ProductCategory;
  },

  // PRODUCTS
  async getAllProducts(filters: {
    category_id?: string;
    is_featured?: boolean;
    is_active?: boolean;
    search?: string;
  } = {}) {
    let query = supabase
      .from('products')
      .select(`
        *,
        product_categories(name)
      `)
      .order('created_at', { ascending: false });

    if (filters.category_id) {
      query = query.eq('category_id', filters.category_id);
    }
    if (filters.is_featured !== undefined) {
      query = query.eq('is_featured', filters.is_featured);
    }
    if (filters.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }
    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%,tags.cs.{${filters.search}}`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as Product[];
  },

  async getProductById(id: string) {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        product_categories(name),
        product_variants(*)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  async createProduct(product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('products')
      .insert([product])
      .select()
      .single();
    
    if (error) throw error;
    return data as Product;
  },

  async updateProduct(id: string, updates: Partial<Product>) {
    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as Product;
  },

  async deleteProduct(id: string) {
    const { data, error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return data;
  },

  async updateStockQuantity(productId: string, variantId: string | null, newQuantity: number) {
    if (variantId) {
      const { data, error } = await supabase
        .from('product_variants')
        .update({ stock_quantity: newQuantity })
        .eq('id', variantId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from('products')
        .update({ stock_quantity: newQuantity })
        .eq('id', productId);
      if (error) throw error;
    }
  },

  // PRODUCT VARIANTS
  async getProductVariants(productId: string) {
    const { data, error } = await supabase
      .from('product_variants')
      .select('*')
      .eq('product_id', productId)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true });
    
    if (error) throw error;
    return data as ProductVariant[];
  },

  async createVariant(variant: Omit<ProductVariant, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('product_variants')
      .insert([variant])
      .select()
      .single();
    
    if (error) throw error;
    return data as ProductVariant;
  },

  // SHOPPING CART
  async getCartItems(clientId: string) {
    const { data, error } = await supabase
      .from('cart_items')
      .select(`
        *,
        products(*),
        product_variants(*)
      `)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async addToCart(clientId: string, productId: string, variantId: string | null, quantity: number) {
    // Check if item already exists in cart
    let query = supabase
      .from('cart_items')
      .select('*')
      .eq('client_id', clientId)
      .eq('product_id', productId);

    if (variantId) {
      query = query.eq('variant_id', variantId);
    } else {
      query = query.is('variant_id', null);
    }

    const { data: existing } = await query.single();

    // Get product details for pricing
    const product = await this.getProductById(productId);
    let price = product.sale_price || product.price;
    
    if (variantId) {
      const variant = product.product_variants.find(v => v.id === variantId);
      if (variant) {
        price += variant.price_adjustment;
      }
    }

    if (existing) {
      // Update quantity
      const { data, error } = await supabase
        .from('cart_items')
        .update({ 
          quantity: existing.quantity + quantity,
          price_per_item: price
        })
        .eq('id', existing.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } else {
      // Add new item
      const { data, error } = await supabase
        .from('cart_items')
        .insert([{
          client_id: clientId,
          product_id: productId,
          variant_id: variantId,
          quantity,
          price_per_item: price
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }
  },

  async updateCartItem(cartItemId: string, quantity: number) {
    if (quantity <= 0) {
      return this.removeFromCart(cartItemId);
    }

    const { data, error } = await supabase
      .from('cart_items')
      .update({ quantity })
      .eq('id', cartItemId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async removeFromCart(cartItemId: string) {
    const { data, error } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', cartItemId);
    
    if (error) throw error;
    return data;
  },

  async clearCart(clientId: string) {
    const { data, error } = await supabase
      .from('cart_items')
      .delete()
      .eq('client_id', clientId);
    
    if (error) throw error;
    return data;
  },

  async calculateCartTotal(clientId: string) {
    const { data, error } = await supabase
      .from('cart_items')
      .select('quantity, price_per_item')
      .eq('client_id', clientId);
    
    if (error) throw error;

    const subtotal = data.reduce((total, item) => {
      return total + (item.quantity * item.price_per_item);
    }, 0);

    const taxRate = 0.0; // Ghana VAT if applicable
    const taxAmount = subtotal * taxRate;
    const total = subtotal + taxAmount;

    return {
      subtotal,
      taxAmount,
      total,
      itemCount: data.reduce((count, item) => count + item.quantity, 0)
    };
  },

  // ORDERS
  async createOrder(orderData: {
    client_id?: string;
    cart_items: any[];
    shipping_address?: any;
    billing_address?: any;
    payment_method?: string;
    notes?: string;
    promo_code_id?: string;
    discount_amount?: number;
  }) {
    const cartTotal = orderData.cart_items.reduce((total, item) => {
      return total + (item.quantity * item.price_per_item);
    }, 0);

    const shippingAmount = this.calculateShipping(orderData.cart_items);
    const taxAmount = 0; // Calculate if needed
    const discountAmount = orderData.discount_amount || 0;
    const totalAmount = cartTotal + shippingAmount + taxAmount - discountAmount;

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([{
        client_id: orderData.client_id,
        subtotal: cartTotal,
        tax_amount: taxAmount,
        shipping_amount: shippingAmount,
        discount_amount: discountAmount,
        total_amount: totalAmount,
        promo_code_id: orderData.promo_code_id,
        payment_method: orderData.payment_method,
        shipping_address: orderData.shipping_address,
        billing_address: orderData.billing_address,
        notes: orderData.notes,
        status: 'pending',
        payment_status: 'pending'
      }])
      .select()
      .single();

    if (orderError) throw orderError;

    // Create order items
    const orderItems = orderData.cart_items.map(item => ({
      order_id: order.id,
      product_id: item.product_id,
      variant_id: item.variant_id,
      product_name: item.products?.name || 'Unknown Product',
      variant_name: item.product_variants?.name,
      quantity: item.quantity,
      price_per_item: item.price_per_item,
      total_price: item.quantity * item.price_per_item
    }));

    const { data: createdItems, error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems)
      .select();

    if (itemsError) throw itemsError;

    // Update stock quantities
    for (const item of orderData.cart_items) {
      const currentStock = item.variant_id ? 
        item.product_variants.stock_quantity : 
        item.products.stock_quantity;
      
      const newStock = Math.max(0, currentStock - item.quantity);
      
      await this.updateStockQuantity(item.product_id, item.variant_id, newStock);
    }

    // Clear cart if client order
    if (orderData.client_id) {
      await this.clearCart(orderData.client_id);
    }

    return { order, orderItems: createdItems };
  },

  async getOrderById(orderId: string) {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items(
          *,
          products(name, images),
          product_variants(name)
        ),
        profiles(full_name, email, phone)
      `)
      .eq('id', orderId)
      .single();
    
    if (error) throw error;
    return data;
  },

  async getClientOrders(clientId: string) {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items(*)
      `)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as Order[];
  },

  async getAllOrders(filters: {
    status?: string;
    payment_status?: string;
    date_from?: string;
    date_to?: string;
  } = {}) {
    let query = supabase
      .from('orders')
      .select(`
        *,
        profiles(full_name, email, phone)
      `)
      .order('created_at', { ascending: false });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.payment_status) {
      query = query.eq('payment_status', filters.payment_status);
    }
    if (filters.date_from) {
      query = query.gte('created_at', filters.date_from);
    }
    if (filters.date_to) {
      query = query.lte('created_at', filters.date_to);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async updateOrderStatus(orderId: string, status: string, trackingInfo?: any) {
    const updateData: any = { status };
    
    if (status === 'shipped' && !trackingInfo) {
      updateData.shipped_at = new Date().toISOString();
    }
    if (status === 'delivered') {
      updateData.delivered_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updatePaymentStatus(orderId: string, paymentStatus: string, paymentReference?: string) {
    const updateData: any = { payment_status: paymentStatus };
    if (paymentReference) {
      updateData.payment_reference = paymentReference;
    }

    const { data, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // UTILITY FUNCTIONS
  calculateShipping(cartItems: any[]): number {
    const requiresShipping = cartItems.some(item => 
      item.products?.requires_shipping !== false
    );
    
    if (!requiresShipping) return 0;

    // Simple shipping calculation - can be made more sophisticated
    const totalWeight = cartItems.reduce((weight, item) => {
      const itemWeight = item.products?.weight_grams || 100; // Default 100g
      return weight + (itemWeight * item.quantity);
    }, 0);

    // GHS 10 base + GHS 2 per 500g
    return 10 + Math.ceil(totalWeight / 500) * 2;
  },

  async getLowStockProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .lte('stock_quantity', supabase.raw('low_stock_threshold'))
      .eq('is_active', true);
    
    if (error) throw error;
    return data as Product[];
  },

  async getFeaturedProducts(limit: number = 8) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_featured', true)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data as Product[];
  },

  async searchProducts(query: string, limit: number = 20) {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        product_categories(name)
      `)
      .eq('is_active', true)
      .or(`name.ilike.%${query}%,description.ilike.%${query}%,brand.ilike.%${query}%`)
      .order('name', { ascending: true })
      .limit(limit);
    
    if (error) throw error;
    return data;
  }
};
