## Description
Provide a concise explanation of what this pull request changes, why it is needed, and any architectural considerations.

## Category Addressed
- [ ] Shallow Water Equations (SWE) / Numerical Physics
- [ ] Geospatial Pipelines / Multi-Town Integrity (Clonmel / Dibrugarh)
- [ ] Hydrologic Scenario Modeling & Boundary Forcing
- [ ] Infrastructure Impact & Freeboard Assessment
- [ ] UI/UX, Three.js 3D Rendering & WebGL2 Shaders
- [ ] Documentation & Engineering Evidence

## Validation & Verification Checklist
- [ ] All unit and benchmark tests pass (`npm test`)
- [ ] Ritter analytical dam-break benchmark passes (< 15% NRMSE, < 1.0% mass error) (`npm run test:benchmark`)
- [ ] Production build succeeds without errors (`npm run build`)
- [ ] Dual-location isolation maintained: Clonmel and Dibrugarh datasets and datums remain strictly separated
- [ ] No unhandled WebGL context loss or memory leaks introduced
- [ ] Screenshots or evidence artifacts updated in `evidence/` if visual components were modified

## Related Issues
Closes #
