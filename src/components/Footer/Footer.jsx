import { Link } from 'react-router-dom'
import './Footer.css'

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-brand">
          <span className="footer-msf">MSF </span>
          <span className="footer-leaderboard">WEBSITE</span>
        </div>
        <div className="footer-credit">Made with ♥ by <span className="footer-handle">Blyde</span> & <span className="footer-handle">Philicreep</span></div>
      </div>
    </footer>
  )
}

export default Footer
