import React from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Stack,
  Divider,
  Button,
  Link,
} from "@mui/material";
import {
  Business as BusinessIcon,
  Code as CodeIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  LocationOn as LocationIcon,
  Web as WebIcon,
  PhoneAndroid as MobileIcon,
  Palette as DesignIcon,
  Cloud as CloudIcon,
  Campaign as MarketingIcon,
  Support as ConsultingIcon,
  ArrowBack as ArrowBackIcon,
} from "@mui/icons-material";
import { motion } from "framer-motion";

interface AboutViewProps {
  onBack: () => void;
}

const AboutView: React.FC<AboutViewProps> = ({ onBack }) => {
  const services = [
    {
      icon: <WebIcon />,
      name: "Web Development",
      description: "Custom websites and web applications",
    },
    {
      icon: <MobileIcon />,
      name: "Mobile Apps",
      description: "Native and cross-platform mobile applications",
    },
    {
      icon: <DesignIcon />,
      name: "UI/UX Design",
      description: "User-centered design services",
    },
    {
      icon: <MarketingIcon />,
      name: "Digital Marketing",
      description: "Comprehensive digital marketing strategies",
    },
    {
      icon: <CloudIcon />,
      name: "Cloud Solutions",
      description: "Scalable cloud infrastructure and services",
    },
    {
      icon: <ConsultingIcon />,
      name: "Consulting",
      description: "Strategic technology consulting",
    },
  ];

  const coreValues = [
    {
      title: "Innovation",
      description:
        "We constantly push boundaries and challenge the status quo to develop innovative solutions that address real-world challenges.",
    },
    {
      title: "Excellence",
      description:
        "We strive for excellence in everything we do, from code quality to design aesthetics and client communication.",
    },
    {
      title: "Integrity",
      description:
        "We conduct business with unwavering honesty, transparency, and ethical standards in all our interactions.",
    },
    {
      title: "Client Focus",
      description:
        "We put our clients' needs first, working closely with them to ensure our solutions deliver measurable business value.",
    },
  ];

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: "auto" }}>
      <Button
        variant="text"
        onClick={onBack}
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 3 }}
      >
        Back
      </Button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <Card
          sx={{
            mb: 4,
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
          }}
        >
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ textAlign: "center" }}>
              <BusinessIcon sx={{ fontSize: 64, mb: 2 }} />
              <Typography variant="h3" gutterBottom fontWeight="bold">
                EKD Digital
              </Typography>
              <Typography variant="h6" sx={{ opacity: 0.9 }}>
                Transforming businesses through innovative digital solutions
              </Typography>
              <Chip
                label="EKD Desk Developer"
                sx={{ mt: 2, bgcolor: "rgba(255,255,255,0.2)", color: "white" }}
              />
            </Box>
          </CardContent>
        </Card>

        {/* About Section */}
        <Card sx={{ mb: 4 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h4" gutterBottom color="primary">
              About EKD Digital
            </Typography>
            <Typography
              variant="body1"
              paragraph
              sx={{ fontSize: "1.1rem", lineHeight: 1.7 }}
            >
              EKD Digital is a cutting-edge software and technology company
              dedicated to transforming businesses through innovative digital
              solutions. We specialize in web development, mobile applications,
              UI/UX design, digital marketing, cloud solutions, and strategic
              technology consulting.
            </Typography>
            <Typography
              variant="body1"
              paragraph
              sx={{ fontSize: "1.1rem", lineHeight: 1.7 }}
            >
              Founded by <strong>Enoch Kwateh Dongbo</strong>, a visionary
              Liberian entrepreneur, EKD Digital combines technical excellence
              with a deep understanding of business challenges to deliver
              transformative technology solutions that drive growth and create
              exceptional digital experiences.
            </Typography>
            <Typography
              variant="body1"
              sx={{ fontSize: "1.1rem", lineHeight: 1.7 }}
            >
              Our team of skilled developers, designers, and consultants work
              collaboratively to provide end-to-end digital solutions tailored
              to your unique business needs. From responsive websites to native
              mobile apps and comprehensive digital strategies, we're committed
              to helping our clients thrive in the digital age.
            </Typography>
          </CardContent>
        </Card>

        {/* Services */}
        <Card sx={{ mb: 4 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h4" gutterBottom color="primary">
              What We Do
            </Typography>
            <Typography variant="body1" paragraph sx={{ mb: 3 }}>
              We provide comprehensive technology solutions designed to
              transform your business and drive success in the digital age.
            </Typography>
            <Grid container spacing={3}>
              {services.map((service, index) => (
                <Grid item xs={12} md={6} key={index}>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    <Card
                      sx={{
                        height: "100%",
                        hover: { transform: "translateY(-4px)" },
                        transition: "transform 0.2s",
                      }}
                    >
                      <CardContent>
                        <Stack
                          direction="row"
                          spacing={2}
                          alignItems="center"
                          mb={2}
                        >
                          <Box sx={{ color: "primary.main" }}>
                            {service.icon}
                          </Box>
                          <Typography variant="h6" fontWeight="bold">
                            {service.name}
                          </Typography>
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          {service.description}
                        </Typography>
                      </CardContent>
                    </Card>
                  </motion.div>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>

        {/* Core Values */}
        <Card sx={{ mb: 4 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h4" gutterBottom color="primary">
              Our Core Values
            </Typography>
            <Grid container spacing={3}>
              {coreValues.map((value, index) => (
                <Grid item xs={12} md={6} key={index}>
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    <Box sx={{ p: 2 }}>
                      <Typography
                        variant="h6"
                        gutterBottom
                        fontWeight="bold"
                        color="primary"
                      >
                        {value.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ lineHeight: 1.6 }}
                      >
                        {value.description}
                      </Typography>
                    </Box>
                  </motion.div>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h4" gutterBottom color="primary">
              Contact Us
            </Typography>
            <Typography variant="body1" paragraph sx={{ mb: 3 }}>
              Ready to transform your business? Let's discuss how our digital
              solutions can help you achieve your business goals and create
              exceptional experiences for your customers.
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <LocationIcon color="primary" />
                  <Box>
                    <Typography variant="subtitle2" fontWeight="bold">
                      Location
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Bernards' Farm, Kpelle Town
                      <br />
                      Paynesville, Liberia
                    </Typography>
                  </Box>
                </Stack>
              </Grid>

              <Grid item xs={12} md={4}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <PhoneIcon color="primary" />
                  <Box>
                    <Typography variant="subtitle2" fontWeight="bold">
                      Phone
                    </Typography>
                    <Link
                      href="tel:+8618506832159"
                      color="inherit"
                      underline="hover"
                    >
                      <Typography variant="body2" color="text.secondary">
                        +86 185 0683 2159
                      </Typography>
                    </Link>
                  </Box>
                </Stack>
              </Grid>

              <Grid item xs={12} md={4}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <EmailIcon color="primary" />
                  <Box>
                    <Typography variant="subtitle2" fontWeight="bold">
                      Email
                    </Typography>
                    <Link
                      href="mailto:support@ekddigital.com"
                      color="inherit"
                      underline="hover"
                    >
                      <Typography variant="body2" color="text.secondary">
                        support@ekddigital.com
                      </Typography>
                    </Link>
                  </Box>
                </Stack>
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Box sx={{ textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                © 2025 EKD Digital. All rights reserved.
              </Typography>
              <Typography variant="caption" color="text.secondary">
                EKD Desk - Advanced Remote Desktop Solution
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </motion.div>
    </Box>
  );
};

export default AboutView;
