# ============================================================================
# TitanGold AWS Application Load Balancer Configuration (INFRA-009)
# ============================================================================
#
# Purpose: Terraform configuration for AWS ALB with SSL termination
#
# Features:
#   - Application Load Balancer (Layer 7)
#   - Target groups with health checks
#   - SSL/TLS termination with ACM certificate
#   - Sticky sessions for WebSocket connections
#   - Security groups
#   - CloudWatch monitoring
#
# Usage:
#   terraform init
#   terraform plan
#   terraform apply
#
# Date: 2026-01-31
# ============================================================================

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# ============================================================================
# Variables
# ============================================================================

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "vpc_id" {
  description = "VPC ID where resources will be created"
  type        = string
}

variable "public_subnet_ids" {
  description = "List of public subnet IDs for ALB"
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for backend instances"
  type        = list(string)
}

variable "certificate_arn" {
  description = "ACM certificate ARN for SSL/TLS"
  type        = string
}

variable "backend_instance_ids" {
  description = "List of backend EC2 instance IDs"
  type        = list(string)
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "api.titangold.com"
}

# ============================================================================
# Security Groups
# ============================================================================

# ALB Security Group
resource "aws_security_group" "alb" {
  name        = "titangold-alb-${var.environment}"
  description = "Security group for TitanGold Application Load Balancer"
  vpc_id      = var.vpc_id

  # Allow HTTP (redirect to HTTPS)
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP from internet"
  }

  # Allow HTTPS
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS from internet"
  }

  # Allow all outbound
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  tags = {
    Name        = "titangold-alb-${var.environment}"
    Environment = var.environment
    Task        = "INFRA-009"
  }
}

# Backend Security Group
resource "aws_security_group" "backend" {
  name        = "titangold-backend-${var.environment}"
  description = "Security group for TitanGold backend instances"
  vpc_id      = var.vpc_id

  # Allow traffic from ALB
  ingress {
    from_port       = 5002
    to_port         = 5002
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
    description     = "Backend API from ALB"
  }

  # Allow SSH (optional, for management)
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"] # Restrict to your IP range
    description = "SSH from management network"
  }

  # Allow all outbound
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  tags = {
    Name        = "titangold-backend-${var.environment}"
    Environment = var.environment
    Task        = "INFRA-009"
  }
}

# ============================================================================
# Application Load Balancer
# ============================================================================

resource "aws_lb" "main" {
  name               = "titangold-alb-${var.environment}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids

  enable_deletion_protection = true
  enable_http2              = true
  enable_cross_zone_load_balancing = true

  tags = {
    Name        = "titangold-alb-${var.environment}"
    Environment = var.environment
    Task        = "INFRA-009"
  }
}

# ============================================================================
# Target Groups
# ============================================================================

# Main API Target Group
resource "aws_lb_target_group" "api" {
  name     = "titangold-api-${var.environment}"
  port     = 5002
  protocol = "HTTP"
  vpc_id   = var.vpc_id

  # Health check configuration
  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    path                = "/health"
    protocol            = "HTTP"
    matcher             = "200"
  }

  # Sticky sessions (for stateful connections)
  stickiness {
    enabled         = true
    type            = "lb_cookie"
    cookie_duration = 86400 # 24 hours
  }

  # Connection draining
  deregistration_delay = 30

  tags = {
    Name        = "titangold-api-${var.environment}"
    Environment = var.environment
    Task        = "INFRA-009"
  }
}

# WebSocket Target Group (separate for WebSocket connections)
resource "aws_lb_target_group" "websocket" {
  name     = "titangold-ws-${var.environment}"
  port     = 5002
  protocol = "HTTP"
  vpc_id   = var.vpc_id

  # Health check
  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    path                = "/health"
    protocol            = "HTTP"
    matcher             = "200"
  }

  # Sticky sessions (required for WebSocket)
  stickiness {
    enabled         = true
    type            = "lb_cookie"
    cookie_duration = 86400 # 24 hours
  }

  # Long deregistration delay for WebSocket connections
  deregistration_delay = 300 # 5 minutes

  tags = {
    Name        = "titangold-ws-${var.environment}"
    Environment = var.environment
    Task        = "INFRA-009"
  }
}

# ============================================================================
# Target Group Attachments
# ============================================================================

resource "aws_lb_target_group_attachment" "api" {
  count            = length(var.backend_instance_ids)
  target_group_arn = aws_lb_target_group.api.arn
  target_id        = var.backend_instance_ids[count.index]
  port             = 5002
}

resource "aws_lb_target_group_attachment" "websocket" {
  count            = length(var.backend_instance_ids)
  target_group_arn = aws_lb_target_group.websocket.arn
  target_id        = var.backend_instance_ids[count.index]
  port             = 5002
}

# ============================================================================
# Listeners
# ============================================================================

# HTTP Listener (redirect to HTTPS)
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# HTTPS Listener
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

# ============================================================================
# Listener Rules
# ============================================================================

# WebSocket routing rule
resource "aws_lb_listener_rule" "websocket" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.websocket.arn
  }

  condition {
    path_pattern {
      values = ["/ws/*"]
    }
  }
}

# Health check routing (lower priority for faster response)
resource "aws_lb_listener_rule" "health" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 5

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  condition {
    path_pattern {
      values = ["/health"]
    }
  }
}

# ============================================================================
# CloudWatch Alarms
# ============================================================================

# High target response time alarm
resource "aws_cloudwatch_metric_alarm" "high_response_time" {
  alarm_name          = "titangold-alb-high-response-time-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Average"
  threshold           = 1000 # 1 second
  alarm_description   = "Alert when average response time exceeds 1 second"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }
}

# Unhealthy target count alarm
resource "aws_cloudwatch_metric_alarm" "unhealthy_targets" {
  alarm_name          = "titangold-alb-unhealthy-targets-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Average"
  threshold           = 0
  alarm_description   = "Alert when any target becomes unhealthy"
  treat_missing_data  = "notBreaching"

  dimensions = {
    TargetGroup  = aws_lb_target_group.api.arn_suffix
    LoadBalancer = aws_lb.main.arn_suffix
  }
}

# ============================================================================
# Outputs
# ============================================================================

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "Canonical hosted zone ID of the load balancer"
  value       = aws_lb.main.zone_id
}

output "alb_arn" {
  description = "ARN of the Application Load Balancer"
  value       = aws_lb.main.arn
}

output "api_target_group_arn" {
  description = "ARN of the API target group"
  value       = aws_lb_target_group.api.arn
}

output "websocket_target_group_arn" {
  description = "ARN of the WebSocket target group"
  value       = aws_lb_target_group.websocket.arn
}
