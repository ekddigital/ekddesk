import React from "react";
import { Box, Typography } from "@mui/material";

interface ConnectViewProps {
  onBack: () => void;
  settings: any;
}

const ConnectView: React.FC<ConnectViewProps> = ({ onBack, settings }) => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5">Connect to Host</Typography>
      <Typography>Connect view will be implemented here</Typography>
    </Box>
  );
};

export default ConnectView;
