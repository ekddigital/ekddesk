import React from "react";
import { Box, Typography } from "@mui/material";

interface HostViewProps {
  onBack: () => void;
  settings: any;
}

const HostView: React.FC<HostViewProps> = ({ onBack, settings }) => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5">Host Session</Typography>
      <Typography>Host view will be implemented here</Typography>
    </Box>
  );
};

export default HostView;
