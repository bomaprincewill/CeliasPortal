"use client";
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="en"><body><main style={{fontFamily:"Segoe UI,Arial,sans-serif",maxWidth:520,margin:"15vh auto",padding:24,textAlign:"center"}}><h1>SchoolPortal is temporarily unavailable</h1><p>Please try the request again. If the problem continues, contact the school administrator.</p><button onClick={reset} style={{padding:"10px 16px",cursor:"pointer"}}>Try again</button></main></body></html>;
}
