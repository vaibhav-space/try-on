import { useState, useCallback, useRef } from 'react'
import TryOnCanvas from './components/TryOnCanvas'
import { getFitColor, getFitEmoji } from './utils/fitCalculator'

// Product catalog with comprehensive metadata for fit calculations
const PRODUCTS = [
    {
        id: 'glasses-1',
        name: 'Classic Black',
        image: '/images/1.png',
        frameWidth: 160,              // mm - standard medium frame
        frameStyle: 'rectangle',
        sizeCategory: 'medium',
        bestForFaces: ['oval', 'round'],
        color: 'Black',
        material: 'Acetate',
        config: {
            widthMultiplier: 1.4,
            verticalOffset: 0.015,
            bridgeOffset: 0
        }
    },
    {
        id: 'glasses-2',
        name: 'Modern Aviator',
        image: '/images/2.png',
        frameWidth: 128,              // mm - medium-large aviator
        frameStyle: 'aviator',
        sizeCategory: 'medium-large',
        bestForFaces: ['oval', 'heart', 'square'],
        color: 'Gold/Black',
        material: 'Metal',
        config: {
            widthMultiplier: 1.35,
            verticalOffset: 0.02,
            bridgeOffset: 0
        }
    },
    {
        id: 'glasses-3',
        name: 'Retro Round',
        image: '/images/3.png',
        // Multi-angle sprites for 2.5D rendering
        sprites: {
            0: '/images/3/0.png',
            15: '/images/3/15.png',
            30: '/images/3/30.png',
            45: '/images/3/45.png'
        },
        frameWidth: 154,              // mm - smaller round frame
        frameStyle: 'round',
        sizeCategory: 'small-medium',
        bestForFaces: ['square', 'oval', 'oblong'],
        color: 'Silver',
        material: 'Metal',
        config: {
            widthMultiplier: 1.3,
            verticalOffset: 0.015,
            bridgeOffset: 0
        }
    },
    {
        id: 'glasses-4',
        name: 'Sport Wrap',
        image: '/images/4.png',
        frameWidth: 150,              // mm - large wraparound
        frameStyle: 'wraparound',
        sizeCategory: 'large',
        bestForFaces: ['oval', 'round', 'square'],
        color: 'Black',
        material: 'TR90/Nylon',
        config: {
            widthMultiplier: 1.45,
            verticalOffset: 0.02,
            bridgeOffset: 0
        }
    },
    {
        id: 'glasses-5',
        name: 'Designer Browline',
        image: '/images/5.png',
        frameWidth: 162,              // mm - medium browline
        frameStyle: 'browline',
        sizeCategory: 'medium',
        bestForFaces: ['oval', 'square', 'heart'],
        color: 'Havana/Gold',
        material: 'Acetate/Metal',
        config: {
            widthMultiplier: 1.35,
            verticalOffset: 0.018,
            bridgeOffset: 0
        }
    }
]

export default function App() {
    const [selectedProduct, setSelectedProduct] = useState(PRODUCTS[0])
    const [showDebug, setShowDebug] = useState(false)
    const [sizingMode, setSizingMode] = useState('aesthetic')  // 'aesthetic' or 'trueSize'
    const [fitInfo, setFitInfo] = useState(null)
    const canvasRef = useRef(null)

    const handleScreenshot = useCallback(async () => {
        if (!canvasRef.current) return

        const image = await canvasRef.current.takeScreenshot()
        if (image) {
            // Create download link
            const link = document.createElement('a')
            link.href = image
            link.download = `try-on-${selectedProduct.name}-${Date.now()}.png`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
        }
    }, [selectedProduct])

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

    const handleFitCalculated = useCallback((info) => {
        setFitInfo(info)
    }, [])

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
                    ref={canvasRef}
                    selectedProduct={selectedProduct}
                    products={PRODUCTS}
                    onProductChange={handleProductChange}
                    onFitCalculated={handleFitCalculated}
                    showDebug={showDebug}
                    sizingMode={sizingMode}
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

                {/* Fit indicator */}
                {fitInfo && fitInfo.fitScore > 0 && (
                    <div className="fit-indicator" style={{ color: getFitColor(fitInfo.fitScore) }}>
                        <span className="fit-emoji">{getFitEmoji(fitInfo.fitScore)}</span>
                        <span className="fit-label">{fitInfo.fitLabel}</span>
                    </div>
                )}

                {/* Product details */}
                <div className="product-details">
                    <span className="product-style">{selectedProduct.frameStyle}</span>
                    <span className="product-size">{selectedProduct.sizeCategory}</span>
                </div>

                <p className="product-index">
                    {PRODUCTS.findIndex(p => p.id === selectedProduct.id) + 1} of {PRODUCTS.length}
                </p>
            </div>

            {/* Footer actions */}
            <footer className="footer">
                <button className="action-button secondary" onClick={() => setShowDebug(!showDebug)}>
                    {showDebug ? 'Hide Debug' : 'Debug'}
                </button>
                <button
                    className="action-button secondary"
                    onClick={() => setSizingMode(m => m === 'aesthetic' ? 'trueSize' : 'aesthetic')}
                    title="Aesthetic: Looks good on all faces. True Size: Shows actual frame size."
                >
                    {sizingMode === 'aesthetic' ? '🌟 Aesthetic' : '📏 True Size'}
                </button>
                <button className="action-button secondary" onClick={handleScreenshot}>
                    Share 📸
                </button>
                <button className="action-button primary">
                    Add to Cart
                </button>
            </footer>
        </div>
    )
}
