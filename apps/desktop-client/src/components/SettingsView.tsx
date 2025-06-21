import React from "react";
import { Box, Typography } from "@mui/material";

interface SettingsViewProps {
  settings: any;
  onSettingsUpdate: (settings: any) => void;
  onBack: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSettingsUpdate,
  onBack,
}) => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5">Settings</Typography>
      <Typography>Settings view will be implemented here</Typography>
    </Box>
  );
};

export default SettingsView;
