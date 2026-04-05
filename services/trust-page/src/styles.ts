/**
 * Embedded CSS for self-contained Trust Page HTML.
 * Uses the Celestir color palette:
 *   Midnight Navy: #0A1628
 *   Aurora Blue:   #1B6B9A
 *   Stardust:      #4DA8DA
 */
export const TRUST_PAGE_CSS = `
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen,Ubuntu,sans-serif;
    line-height:1.6;color:#e8edf3;background:#0A1628;
    max-width:960px;margin:0 auto;padding:32px 16px;
  }
  h1{font-size:1.75rem;font-weight:700;margin-bottom:4px;color:#fff}
  h2{font-size:1.25rem;font-weight:600;margin-bottom:12px;color:#4DA8DA}
  h3{font-size:1rem;font-weight:600;margin-bottom:8px;color:#8bb8cc}
  a{color:#4DA8DA;text-decoration:none}
  a:hover{text-decoration:underline}
  .header{text-align:center;margin-bottom:40px;padding-bottom:24px;border-bottom:1px solid #1a2a40}
  .header h1{font-size:2rem;letter-spacing:-0.5px}
  .header p{color:#8899aa;font-size:0.875rem}
  .chain-id{font-family:monospace;font-size:0.875rem;color:#4DA8DA;word-break:break-all}
  .badge{
    display:inline-flex;align-items:center;gap:6px;
    padding:8px 20px;border-radius:24px;font-weight:600;font-size:0.9rem;
    margin:12px 0;
  }
  .badge-valid{background:#1B6B9A;color:#fff}
  .badge-invalid{background:#c0392b;color:#fff}
  .badge-icon{font-size:1.1rem}
  .section{
    background:#0f1f35;border:1px solid #1a2a40;border-radius:8px;
    padding:20px;margin-bottom:16px;
  }
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
  .stat{
    background:#0A1628;border:1px solid #1a2a40;border-radius:6px;padding:12px;text-align:center;
  }
  .stat-value{font-size:1.5rem;font-weight:700;color:#4DA8DA}
  .stat-label{font-size:0.75rem;color:#8899aa;text-transform:uppercase;letter-spacing:0.5px}
  table{width:100%;border-collapse:collapse;font-size:0.875rem}
  th{
    text-align:left;padding:8px 12px;background:#0A1628;
    font-weight:600;color:#8899aa;font-size:0.75rem;text-transform:uppercase;
    letter-spacing:0.5px;border-bottom:1px solid #1a2a40;
  }
  td{padding:8px 12px;border-bottom:1px solid #1a2a40;color:#c8d6e0}
  .mono{font-family:monospace;font-size:0.8rem}
  .tag{
    display:inline-block;background:#1a2a40;border-radius:4px;
    padding:2px 8px;font-size:0.75rem;margin:2px;color:#4DA8DA;
  }
  .confidence-bar{
    height:6px;border-radius:3px;background:#1a2a40;overflow:hidden;
    margin-top:4px;
  }
  .confidence-fill{height:100%;border-radius:3px;background:#1B6B9A}
  .error-detail{
    background:#2a1a1a;border:1px solid #5a2a2a;border-radius:6px;
    padding:12px;margin-top:8px;font-size:0.875rem;color:#e8a0a0;
  }
  .review-bar{
    height:12px;border-radius:6px;background:#1a2a40;overflow:hidden;
    display:flex;margin-top:8px;
  }
  .review-approved{background:#1B6B9A;height:100%}
  .review-rejected{background:#c0392b;height:100%}
  .review-pending{background:#f39c12;height:100%}
  .compliance-list{list-style:none;padding:0}
  .compliance-item{
    display:flex;align-items:center;gap:8px;
    padding:8px 0;border-bottom:1px solid #1a2a40;font-size:0.875rem;
  }
  .compliance-item:last-child{border-bottom:none}
  .compliance-check{color:#1B6B9A;font-weight:bold}
  .footer{
    text-align:center;color:#556677;font-size:0.75rem;
    margin-top:32px;padding-top:16px;border-top:1px solid #1a2a40;
  }
  .empty{color:#556677;font-style:italic;font-size:0.875rem}
  @media(max-width:600px){
    body{padding:12px 8px}
    .grid{grid-template-columns:1fr}
    table{font-size:0.75rem}
    th,td{padding:6px 8px}
  }
`;
