import React from "react";
import { Box, Typography } from "@mui/material";

interface StatusBarProps {
  connectionState: any;
}

const StatusBar: React.FC<StatusBarProps> = ({ connectionState }) => {
  return (
    <Box
      sx={{
        p: 1,
        bgcolor: "background.paper",
        borderTop: "1px solid",
        borderColor: "divider",
      }}
    >
      <Typography variant="caption">
        Status: {connectionState.status}
      </Typography>
    </Box>
  );
};

export default StatusBar;
