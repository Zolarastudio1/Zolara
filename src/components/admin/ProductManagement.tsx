import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, Package, Search, Filter, Star, Eye, ShoppingCart, AlertTriangle, Upload, Image as ImageIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Switch } from '../ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Alert, AlertDescription } from '../ui/alert';
import { Separator } from '../ui/separator';
import { ecommerceService, Product, ProductCategory } from '../../lib/ecommerce';

export const ProductManagement: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    short_description: '',
    sku: '',
    price: '',
    sale_price: '',
    category_id: '',
    brand: '',
    weight_grams: '',
    dimensions: '',
    stock_quantity: '',
    low_stock_threshold: '10',
    is_digital: false,
    requires_shipping: true,
    is_featured: false,
    is_active: true,
    images: [] as string[],
    tags: [] as string[],
    meta_title: '',
    meta_description: ''
  });

  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    slug: '',
    parent_category_id: '',
    is_active: true,
    display_order: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, searchTerm, selectedCategory, statusFilter]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [productsData, categoriesData] = await Promise.all([
        ecommerceService.getAllProducts(),
        ecommerceService.getAllCategories()
      ]);
      
      setProducts(productsData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterProducts = () => {
    let filtered = products;

    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (selectedCategory) {
      filtered = filtered.filter(product => product.category_id === selectedCategory);
    }

    if (statusFilter === 'active') {
      filtered = filtered.filter(product => product.is_active);
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter(product => !product.is_active);
    } else if (statusFilter === 'featured') {
      filtered = filtered.filter(product => product.is_featured);
    } else if (statusFilter === 'low_stock') {
      filtered = filtered.filter(product => product.stock_quantity <= product.low_stock_threshold);
    }

    setFilteredProducts(filtered);
  };

  const openProductDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setProductForm({
        name: product.name,
        description: product.description || '',
        short_description: product.short_description || '',
        sku: product.sku || '',
        price: product.price.toString(),
        sale_price: product.sale_price?.toString() || '',
        category_id: product.category_id || '',
        brand: product.brand || '',
        weight_grams: product.weight_grams?.toString() || '',
        dimensions: product.dimensions || '',
        stock_quantity: product.stock_quantity.toString(),
        low_stock_threshold: product.low_stock_threshold.toString(),
        is_digital: product.is_digital,
        requires_shipping: product.requires_shipping,
        is_featured: product.is_featured,
        is_active: product.is_active,
        images: product.images,
        tags: product.tags,
        meta_title: product.meta_title || '',
        meta_description: product.meta_description || ''
      });
    } else {
      setEditingProduct(null);
      setProductForm({
        name: '',
        description: '',
        short_description: '',
        sku: '',
        price: '',
        sale_price: '',
        category_id: '',
        brand: '',
        weight_grams: '',
        dimensions: '',
        stock_quantity: '',
        low_stock_threshold: '10',
        is_digital: false,
        requires_shipping: true,
        is_featured: false,
        is_active: true,
        images: [],
        tags: [],
        meta_title: '',
        meta_description: ''
      });
    }
    setIsProductDialogOpen(true);
  };

  const handleSaveProduct = async () => {
    try {
      const productData = {
        name: productForm.name.trim(),
        description: productForm.description.trim() || null,
        short_description: productForm.short_description.trim() || null,
        sku: productForm.sku.trim() || null,
        price: parseFloat(productForm.price),
        sale_price: productForm.sale_price ? parseFloat(productForm.sale_price) : null,
        category_id: productForm.category_id || null,
        brand: productForm.brand.trim() || null,
        weight_grams: productForm.weight_grams ? parseInt(productForm.weight_grams) : null,
        dimensions: productForm.dimensions.trim() || null,
        stock_quantity: parseInt(productForm.stock_quantity),
        low_stock_threshold: parseInt(productForm.low_stock_threshold),
        is_digital: productForm.is_digital,
        requires_shipping: productForm.requires_shipping,
        is_featured: productForm.is_featured,
        is_active: productForm.is_active,
        images: productForm.images,
        tags: productForm.tags,
        meta_title: productForm.meta_title.trim() || null,
        meta_description: productForm.meta_description.trim() || null
      };

      if (editingProduct) {
        await ecommerceService.updateProduct(editingProduct.id, productData);
        alert('Product updated successfully!');
      } else {
        await ecommerceService.createProduct(productData);
        alert('Product created successfully!');
      }

      setIsProductDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Failed to save product:', error);
      alert('Failed to save product. Please try again.');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
      return;
    }

    try {
      await ecommerceService.deleteProduct(productId);
      alert('Product deleted successfully!');
      loadData();
    } catch (error) {
      console.error('Failed to delete product:', error);
      alert('Failed to delete product. Please try again.');
    }
  };

  const getStockStatus = (product: Product) => {
    if (product.stock_quantity <= 0) {
      return { status: 'out_of_stock', color: 'red', text: 'Out of Stock' };
    } else if (product.stock_quantity <= product.low_stock_threshold) {
      return { status: 'low_stock', color: 'orange', text: 'Low Stock' };
    } else {
      return { status: 'in_stock', color: 'green', text: 'In Stock' };
    }
  };

  const addTag = (tag: string) => {
    if (tag.trim() && !productForm.tags.includes(tag.trim())) {
      setProductForm({
        ...productForm,
        tags: [...productForm.tags, tag.trim()]
      });
    }
  };

  const removeTag = (tagToRemove: string) => {
    setProductForm({
      ...productForm,
      tags: productForm.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-charcoal">Product Management</h1>
        <div className="flex gap-2">
          <Button onClick={() => setIsCategoryDialogOpen(true)} variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Add Category
          </Button>
          <Button onClick={() => openProductDialog()} className="bg-gold hover:bg-gold/90 text-charcoal">
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Search Products</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search name, brand, SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div>
              <Label>Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All categories</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="featured">Featured</SelectItem>
                  <SelectItem value="low_stock">Low Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button 
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('');
                  setStatusFilter('');
                }}
                variant="outline"
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Grid */}
      {isLoading ? (
        <div className="text-center py-8">Loading products...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map((product) => {
            const stockStatus = getStockStatus(product);
            const category = categories.find(cat => cat.id === product.category_id);
            
            return (
              <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="relative">
                  {product.images && product.images.length > 0 ? (
                    <img 
                      src={product.images[0]} 
                      alt={product.name}
                      className="w-full h-48 object-cover"
                    />
                  ) : (
                    <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
                      <ImageIcon className="w-12 h-12 text-gray-400" />
                    </div>
                  )}
                  
                  <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                    {!product.is_active && (
                      <Badge variant="secondary" className="bg-red-100 text-red-700 text-xs">
                        Inactive
                      </Badge>
                    )}
                    {product.is_featured && (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 text-xs">
                        Featured
                      </Badge>
                    )}
                    {product.is_digital && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">
                        Digital
                      </Badge>
                    )}
                  </div>

                  <div className="absolute top-2 right-2">
                    <Badge className={`bg-${stockStatus.color}-100 text-${stockStatus.color}-700 text-xs`}>
                      {stockStatus.text}
                    </Badge>
                  </div>
                </div>

                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div>
                      <h3 className="font-semibold text-sm line-clamp-1">{product.name}</h3>
                      {category && (
                        <p className="text-xs text-muted-text">{category.name}</p>
                      )}
                      {product.brand && (
                        <p className="text-xs text-muted-text">{product.brand}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {product.sale_price ? (
                          <>
                            <span className="text-sm font-bold text-gold">GHS {product.sale_price}</span>
                            <span className="text-xs text-muted-text line-through">GHS {product.price}</span>
                          </>
                        ) : (
                          <span className="text-sm font-bold text-gold">GHS {product.price}</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-text">
                        Stock: {product.stock_quantity}
                      </div>
                    </div>

                    {product.short_description && (
                      <p className="text-xs text-muted-text line-clamp-2">
                        {product.short_description}
                      </p>
                    )}

                    {product.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {product.tags.slice(0, 3).map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {product.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{product.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className="flex gap-1 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedProduct(product)}
                        className="flex-1 text-xs"
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openProductDialog(product)}
                        className="flex-1 text-xs"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteProduct(product.id)}
                        className="text-red-600 text-xs"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {filteredProducts.length === 0 && !isLoading && (
        <Card>
          <CardContent className="py-8 text-center text-muted-text">
            No products found matching your filters.
          </CardContent>
        </Card>
      )}

      {/* Product Detail Dialog */}
      {selectedProduct && (
        <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedProduct.name}</DialogTitle>
            </DialogHeader>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Images */}
              <div className="space-y-4">
                {selectedProduct.images && selectedProduct.images.length > 0 ? (
                  <div className="space-y-2">
                    <img 
                      src={selectedProduct.images[0]} 
                      alt={selectedProduct.name}
                      className="w-full h-64 object-cover rounded-lg"
                    />
                    {selectedProduct.images.length > 1 && (
                      <div className="grid grid-cols-4 gap-2">
                        {selectedProduct.images.slice(1, 5).map((image, index) => (
                          <img 
                            key={index}
                            src={image} 
                            alt={`${selectedProduct.name} ${index + 2}`}
                            className="w-full h-16 object-cover rounded"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full h-64 bg-gray-200 rounded-lg flex items-center justify-center">
                    <ImageIcon className="w-16 h-16 text-gray-400" />
                  </div>
                )}
              </div>

              {/* Product Details */}
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold">{selectedProduct.name}</h2>
                  {selectedProduct.brand && (
                    <p className="text-muted-text">by {selectedProduct.brand}</p>
                  )}
                </div>

                {selectedProduct.description && (
                  <div>
                    <h3 className="font-medium mb-1">Description</h3>
                    <p className="text-sm text-muted-text whitespace-pre-wrap">
                      {selectedProduct.description}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Price:</span> GHS {selectedProduct.price}
                  </div>
                  {selectedProduct.sale_price && (
                    <div>
                      <span className="font-medium">Sale Price:</span> GHS {selectedProduct.sale_price}
                    </div>
                  )}
                  <div>
                    <span className="font-medium">Stock:</span> {selectedProduct.stock_quantity}
                  </div>
                  {selectedProduct.sku && (
                    <div>
                      <span className="font-medium">SKU:</span> {selectedProduct.sku}
                    </div>
                  )}
                  {selectedProduct.weight_grams && (
                    <div>
                      <span className="font-medium">Weight:</span> {selectedProduct.weight_grams}g
                    </div>
                  )}
                  {selectedProduct.dimensions && (
                    <div>
                      <span className="font-medium">Dimensions:</span> {selectedProduct.dimensions}
                    </div>
                  )}
                </div>

                {selectedProduct.tags.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-2">Tags</h3>
                    <div className="flex flex-wrap gap-1">
                      {selectedProduct.tags.map((tag, index) => (
                        <Badge key={index} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Create/Edit Product Dialog */}
      <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Edit Product' : 'Create New Product'}
            </DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
              <TabsTrigger value="seo">SEO & Meta</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Product Name *</Label>
                  <Input
                    id="name"
                    value={productForm.name}
                    onChange={(e) => setProductForm({...productForm, name: e.target.value})}
                    placeholder="e.g. Luxury Hair Serum"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="brand">Brand</Label>
                  <Input
                    id="brand"
                    value={productForm.brand}
                    onChange={(e) => setProductForm({...productForm, brand: e.target.value})}
                    placeholder="e.g. Zolara Beauty"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="short_description">Short Description</Label>
                <Textarea
                  id="short_description"
                  value={productForm.short_description}
                  onChange={(e) => setProductForm({...productForm, short_description: e.target.value})}
                  placeholder="Brief product description for listings..."
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="description">Full Description</Label>
                <Textarea
                  id="description"
                  value={productForm.description}
                  onChange={(e) => setProductForm({...productForm, description: e.target.value})}
                  placeholder="Detailed product description..."
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="price">Price (GHS) *</Label>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={productForm.price}
                    onChange={(e) => setProductForm({...productForm, price: e.target.value})}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="sale_price">Sale Price (GHS)</Label>
                  <Input
                    id="sale_price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={productForm.sale_price}
                    onChange={(e) => setProductForm({...productForm, sale_price: e.target.value})}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <Label htmlFor="category_id">Category</Label>
                  <Select 
                    value={productForm.category_id} 
                    onValueChange={(value) => setProductForm({...productForm, category_id: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(category => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={productForm.is_active}
                    onCheckedChange={(checked) => setProductForm({...productForm, is_active: checked})}
                  />
                  <Label htmlFor="is_active">Active (available for purchase)</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_featured"
                    checked={productForm.is_featured}
                    onCheckedChange={(checked) => setProductForm({...productForm, is_featured: checked})}
                  />
                  <Label htmlFor="is_featured">Featured product</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_digital"
                    checked={productForm.is_digital}
                    onCheckedChange={(checked) => setProductForm({...productForm, is_digital: checked})}
                  />
                  <Label htmlFor="is_digital">Digital product (no shipping)</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="requires_shipping"
                    checked={productForm.requires_shipping}
                    onCheckedChange={(checked) => setProductForm({...productForm, requires_shipping: checked})}
                  />
                  <Label htmlFor="requires_shipping">Requires shipping</Label>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="inventory" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    value={productForm.sku}
                    onChange={(e) => setProductForm({...productForm, sku: e.target.value})}
                    placeholder="e.g. ZB-SERUM-001"
                  />
                </div>
                <div>
                  <Label htmlFor="stock_quantity">Stock Quantity *</Label>
                  <Input
                    id="stock_quantity"
                    type="number"
                    min="0"
                    value={productForm.stock_quantity}
                    onChange={(e) => setProductForm({...productForm, stock_quantity: e.target.value})}
                    placeholder="0"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="low_stock_threshold">Low Stock Alert</Label>
                  <Input
                    id="low_stock_threshold"
                    type="number"
                    min="0"
                    value={productForm.low_stock_threshold}
                    onChange={(e) => setProductForm({...productForm, low_stock_threshold: e.target.value})}
                    placeholder="10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="weight_grams">Weight (grams)</Label>
                  <Input
                    id="weight_grams"
                    type="number"
                    min="0"
                    value={productForm.weight_grams}
                    onChange={(e) => setProductForm({...productForm, weight_grams: e.target.value})}
                    placeholder="e.g. 250"
                  />
                </div>
                <div>
                  <Label htmlFor="dimensions">Dimensions (L x W x H)</Label>
                  <Input
                    id="dimensions"
                    value={productForm.dimensions}
                    onChange={(e) => setProductForm({...productForm, dimensions: e.target.value})}
                    placeholder="e.g. 10cm x 5cm x 15cm"
                  />
                </div>
              </div>

              <div>
                <Label>Product Tags</Label>
                <div className="flex flex-wrap gap-1 mt-1 mb-2">
                  {productForm.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                      {tag} ×
                    </Badge>
                  ))}
                </div>
                <Input
                  placeholder="Add tags and press Enter..."
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag(e.currentTarget.value);
                      e.currentTarget.value = '';
                    }
                  }}
                />
              </div>
            </TabsContent>

            <TabsContent value="seo" className="space-y-4">
              <div>
                <Label htmlFor="meta_title">Meta Title</Label>
                <Input
                  id="meta_title"
                  value={productForm.meta_title}
                  onChange={(e) => setProductForm({...productForm, meta_title: e.target.value})}
                  placeholder="SEO title for search engines"
                />
              </div>

              <div>
                <Label htmlFor="meta_description">Meta Description</Label>
                <Textarea
                  id="meta_description"
                  value={productForm.meta_description}
                  onChange={(e) => setProductForm({...productForm, meta_description: e.target.value})}
                  placeholder="SEO description for search engines (150-160 characters recommended)"
                  rows={3}
                />
                <p className="text-sm text-muted-text mt-1">
                  {productForm.meta_description.length}/160 characters
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsProductDialogOpen(false)}
              className="flex-1"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSaveProduct}
              disabled={!productForm.name.trim() || !productForm.price}
              className="flex-1 bg-gold hover:bg-gold/90 text-charcoal"
            >
              <Save className="w-4 h-4 mr-2" />
              {editingProduct ? 'Update Product' : 'Create Product'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Summary Stats */}
      {products.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Product Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-charcoal">{products.length}</div>
                <div className="text-sm text-muted-text">Total Products</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {products.filter(p => p.is_active).length}
                </div>
                <div className="text-sm text-muted-text">Active</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">
                  {products.filter(p => p.is_featured).length}
                </div>
                <div className="text-sm text-muted-text">Featured</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {products.filter(p => p.stock_quantity <= p.low_stock_threshold).length}
                </div>
                <div className="text-sm text-muted-text">Low Stock</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">
                  {products.filter(p => p.stock_quantity === 0).length}
                </div>
                <div className="text-sm text-muted-text">Out of Stock</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {categories.length}
                </div>
                <div className="text-sm text-muted-text">Categories</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
