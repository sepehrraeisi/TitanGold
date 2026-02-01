#!/bin/bash
# ============================================================================
# TitanGold Load Balancer Setup Script (INFRA-009)
# ============================================================================
#
# Purpose: Automated setup of nginx load balancer for TitanGold
#
# Usage:
#   sudo ./setup-lb.sh
#
# Features:
#   - Installs nginx
#   - Generates DH parameters
#   - Configures load balancer
#   - Sets up SSL with Let's Encrypt
#
# Date: 2026-01-31
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN_API="${DOMAIN_API:-api.titangold.com}"
DOMAIN_APP="${DOMAIN_APP:-titangold.com}"
EMAIL="${EMAIL:-admin@titangold.com}"
BACKEND_SERVERS="${BACKEND_SERVERS:-localhost:5002}"

# Functions
print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "This script must be run as root"
        exit 1
    fi
}

install_nginx() {
    print_header "Installing Nginx"
    
    if command -v nginx &> /dev/null; then
        print_success "Nginx already installed"
        nginx -v
    else
        apt update
        apt install -y nginx
        print_success "Nginx installed"
    fi
}

generate_dhparam() {
    print_header "Generating DH Parameters"
    
    if [ -f /etc/nginx/dhparam.pem ]; then
        print_success "DH parameters already exist"
    else
        print_warning "Generating DH parameters (this takes 5-10 minutes)..."
        openssl dhparam -out /etc/nginx/dhparam.pem 4096
        print_success "DH parameters generated"
    fi
}

configure_nginx() {
    print_header "Configuring Nginx"
    
    # Backup existing configuration
    if [ -f /etc/nginx/sites-available/titangold ]; then
        cp /etc/nginx/sites-available/titangold /etc/nginx/sites-available/titangold.backup.$(date +%Y%m%d_%H%M%S)
        print_success "Backed up existing configuration"
    fi
    
    # Copy new configuration
    cp infrastructure/nginx.conf /etc/nginx/sites-available/titangold
    
    # Update backend servers in configuration
    sed -i "s|server localhost:5002|server ${BACKEND_SERVERS}|g" /etc/nginx/sites-available/titangold
    
    # Enable site
    ln -sf /etc/nginx/sites-available/titangold /etc/nginx/sites-enabled/
    
    # Remove default site
    rm -f /etc/nginx/sites-enabled/default
    
    print_success "Nginx configured"
}

install_certbot() {
    print_header "Installing Certbot"
    
    if command -v certbot &> /dev/null; then
        print_success "Certbot already installed"
    else
        apt install -y certbot python3-certbot-nginx
        print_success "Certbot installed"
    fi
}

setup_ssl() {
    print_header "Setting Up SSL Certificates"
    
    # Check if certificates already exist
    if [ -f /etc/letsencrypt/live/${DOMAIN_API}/fullchain.pem ]; then
        print_success "SSL certificates already exist"
        return 0
    fi
    
    print_warning "Obtaining SSL certificates..."
    print_warning "Make sure DNS records point to this server!"
    read -p "Press Enter to continue or Ctrl+C to cancel..."
    
    # Obtain certificates
    certbot --nginx \
        -d ${DOMAIN_API} \
        -d ${DOMAIN_APP} \
        -d www.${DOMAIN_APP} \
        --email ${EMAIL} \
        --agree-tos \
        --no-eff-email \
        --redirect
    
    print_success "SSL certificates obtained"
    
    # Test automatic renewal
    certbot renew --dry-run
    print_success "Automatic renewal configured"
}

test_configuration() {
    print_header "Testing Configuration"
    
    # Test nginx configuration
    if nginx -t; then
        print_success "Nginx configuration is valid"
    else
        print_error "Nginx configuration has errors"
        exit 1
    fi
}

restart_nginx() {
    print_header "Restarting Nginx"
    
    systemctl enable nginx
    systemctl restart nginx
    
    print_success "Nginx restarted and enabled on boot"
}

setup_monitoring() {
    print_header "Setting Up Monitoring"
    
    # Create log rotation configuration
    cat > /etc/logrotate.d/titangold-nginx << 'EOF'
/var/log/nginx/titangold-*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        if [ -f /var/run/nginx.pid ]; then
            kill -USR1 `cat /var/run/nginx.pid`
        fi
    endscript
}
EOF
    
    print_success "Log rotation configured"
    
    # Create monitoring script
    cp infrastructure/health-check.sh /usr/local/bin/titangold-health-check
    chmod +x /usr/local/bin/titangold-health-check
    
    print_success "Health check script installed"
}

display_summary() {
    print_header "Setup Complete!"
    
    echo -e "${GREEN}TitanGold Load Balancer is now configured and running${NC}"
    echo ""
    echo "Configuration:"
    echo "  - API Domain: ${DOMAIN_API}"
    echo "  - App Domain: ${DOMAIN_APP}"
    echo "  - Backend Servers: ${BACKEND_SERVERS}"
    echo ""
    echo "Next steps:"
    echo "  1. Verify DNS records point to this server"
    echo "  2. Test health endpoint: curl https://${DOMAIN_API}/health"
    echo "  3. Monitor logs: sudo tail -f /var/log/nginx/titangold-access.log"
    echo "  4. Check SSL: openssl s_client -connect ${DOMAIN_API}:443"
    echo ""
    echo "Useful commands:"
    echo "  - Test configuration: sudo nginx -t"
    echo "  - Reload nginx: sudo systemctl reload nginx"
    echo "  - View logs: sudo tail -f /var/log/nginx/titangold-error.log"
    echo "  - Health check: /usr/local/bin/titangold-health-check"
    echo ""
}

# Main execution
main() {
    print_header "TitanGold Load Balancer Setup"
    
    # Check root
    check_root
    
    # Configuration
    echo "Configuration:"
    echo "  DOMAIN_API: ${DOMAIN_API}"
    echo "  DOMAIN_APP: ${DOMAIN_APP}"
    echo "  EMAIL: ${EMAIL}"
    echo "  BACKEND_SERVERS: ${BACKEND_SERVERS}"
    echo ""
    read -p "Press Enter to continue or Ctrl+C to cancel..."
    
    # Run setup steps
    install_nginx
    generate_dhparam
    configure_nginx
    install_certbot
    test_configuration
    restart_nginx
    
    # Optional SSL setup
    read -p "Do you want to set up SSL certificates now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        setup_ssl
    else
        print_warning "Skipping SSL setup. Run 'sudo certbot --nginx' later to set up SSL."
    fi
    
    setup_monitoring
    display_summary
}

# Run main function
main "$@"
