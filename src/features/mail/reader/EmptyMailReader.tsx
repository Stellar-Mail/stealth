import "./empty-reader.css";

export function EmptyMailReader() {
  return (
    <div className="reader-empty">
      <div className="reader-empty-composition">
        <div className="sealed-mail-scene" aria-hidden="true">
          <div className="sealed-mail-ground" />
          <div className="sealed-mail-perspective">
            <div className="sealed-mail-assembly">
              <div className="sealed-mail-layer sealed-mail-layer-back">
                <span className="sealed-mail-stamp" />
              </div>
              <div className="sealed-mail-layer sealed-mail-layer-middle">
                <span className="sealed-mail-stamp" />
              </div>
              <div className="sealed-mail-envelope">
                <div className="sealed-mail-inner" />
                <div className="sealed-mail-pocket" />
                <div className="sealed-mail-flap-shadow" />
                <div className="sealed-mail-flap" />
                <div className="sealed-mail-engraving">STEALTH</div>
                <div className="sealed-mail-seal">
                  <div className="sealed-mail-seal-face">
                    <svg viewBox="0 0 32 32" fill="none">
                      <path d="m17 5 2.5 7.5L27 15l-7.5 2.5L17 25l-2.5-7.5L7 15l7.5-2.5L17 5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                      <path d="M7 4v6M4 7h6M25 23v5m-2.5-2.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>
                <div className="sealed-mail-edge" />
              </div>
            </div>
          </div>
        </div>
        <div className="reader-empty-copy">
          <p className="reader-empty-eyebrow"><span />PRIVATE BY DEFAULT<span /></p>
          <h2>Open only what you choose.</h2>
          <p className="reader-empty-description">A little space, just for you.<br />Your messages stay closed until you select one.</p>
        </div>
      </div>
    </div>
  );
}
