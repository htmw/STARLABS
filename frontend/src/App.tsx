import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

import ImageUploader from './components/ImageUploader'
import ImageGallery, { type GalleryImage } from './components/ImageGallery'   

function App() {
  const [count, setCount] = useState(0)
  const [images, setImages] = useState<GalleryImage[]>([])

  const handleUploadSuccess = (items: any[]) => {
    const arr = Array.isArray(items) ? items : [items]
    setImages((prev) => [...arr, ...prev])
  }
  const addMockImage = () => {
  setImages((prev) => [
    {
      id: String(Date.now()),
      url: "https://picsum.photos/300/300",
      title: "Mock Image",
    },
    ...prev,
  ])
}

  return (
    <>
      <h2 style={{ textAlign: "center", marginTop: 18 }}>STARLABS Upload</h2>
      <ImageUploader />
      <h2 style={{ textAlign: "center", marginTop: 18 }}>Gallery</h2>
      <ImageGallery images={images} />
      <div style={{ textAlign: "center", marginTop: 10 }}>
      <button onClick={addMockImage} style={{ padding: "8px 12px" }}>
        Add Mock Image
      </button>
      </div>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App