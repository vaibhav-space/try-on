import { useState, useCallback } from 'react'
import TryOnCanvas from './components/TryOnCanvas'

// Product catalog - using images from the images folder
const PRODUCTS = [
    {
        id: 'glasses-1',
        name: 'Classic Black',
        image: '/images/1.png',
        config: {
            widthMultiplier: 1.4,
            verticalOffset: 0.015
        }
    },
    {
        id: 'glasses-2',
        name: 'Modern Style',
        image: '/images/2.png',
        config: {
            widthMultiplier: 1.35,
            verticalOffset: 0.02
        }
    },
    {
        id: 'glasses-3',
        name: 'Retro Round',
        image: '/images/3.png',
        config: {
            widthMultiplier: 1.3,
            verticalOffset: 0.015
        }
    },
    {
        id: 'glasses-4',
        name: 'Sport Fit',
        image: '/images/4.png',
        config: {
            widthMultiplier: 1.45,
            verticalOffset: 0.02
        }
    },
    {
        id: 'glasses-5',
        name: 'Designer Frame',
        image: '/images/5.png',
        config: {
            widthMultiplier: 1.35,
            verticalOffset: 0.018
        }
    }
]

export default function App() {
    const [selectedProduct, setSelectedProduct] = useState(PRODUCTS[0])
    const [showDebug, setShowDebug] = useState(false)

    const handleProductChange = useCallback((product) => {
        setSelectedProduct(product)
    }, [])

    const handlePrevious = useCallback(() => {
        const currentIndex = PRODUCTS.findIndex(p => p.id === selectedProduct.id)
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : PRODUCTS.length - 1
        setSelectedProduct(PRODUCTS[prevIndex])
    }, [selectedProduct])

    const handleNext = useCallback(() => {
        const currentIndex = PRODUCTS.findIndex(p => p.id === selectedProduct.id)
        const nextIndex = currentIndex < PRODUCTS.length - 1 ? currentIndex + 1 : 0
        setSelectedProduct(PRODUCTS[nextIndex])
    }, [selectedProduct])

    return (
        <div className="app">
            {/* Header */}
            <header className="header">
                <h1>Virtual Try-On</h1>
                <span className="version-badge">Beta</span>
            </header>

            {/* Main try-on area */}
            <main className="main-content">
                <TryOnCanvas
                    selectedProduct={selectedProduct}
                    products={PRODUCTS}
                    onProductChange={handleProductChange}
                    showDebug={showDebug}
                />
            </main>

            {/* Product selector */}
            <section className="product-selector">
                <button
                    className="nav-button prev"
                    onClick={handlePrevious}
                    aria-label="Previous product"
                >
                    ‹
                </button>

                <div className="product-carousel">
                    {PRODUCTS.map((product) => (
                        <button
                            key={product.id}
                            className={`product-thumb ${selectedProduct.id === product.id ? 'active' : ''}`}
                            onClick={() => handleProductChange(product)}
                            aria-label={`Select ${product.name}`}
                        >
                            <img src={product.image} alt={product.name} />
                        </button>
                    ))}
                </div>

                <button
                    className="nav-button next"
                    onClick={handleNext}
                    aria-label="Next product"
                >
                    ›
                </button>
            </section>

            {/* Product info */}
            <div className="product-info">
                <h2>{selectedProduct.name}</h2>
                <p className="product-index">
                    {PRODUCTS.findIndex(p => p.id === selectedProduct.id) + 1} of {PRODUCTS.length}
                </p>
            </div>

            {/* Footer actions */}
            <footer className="footer">
                <button className="action-button secondary" onClick={() => setShowDebug(!showDebug)}>
                    {showDebug ? 'Hide Debug' : 'Debug'}
                </button>
                <button className="action-button primary">
                    Add to Cart
                </button>
            </footer>
        </div>
    )
}
