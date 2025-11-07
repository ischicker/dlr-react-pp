import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import DynamicLineRating from './DynamicLineRating'


const root = createRoot(document.getElementById('root')!)
root.render(
<React.StrictMode>
<DynamicLineRating />
</React.StrictMode>
)
