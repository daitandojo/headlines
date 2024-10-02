import fs from 'fs';
import path from 'path';
import cliProgress from 'cli-progress';

// Configuration
const rootDirectory = './';
const srcDirectory = './src';
const outputFile = 'project.txt';

// Initialize progress bar
const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

// Utility to check if a file should be included (ignores `node_modules`, `project.txt`, and directories)
function shouldInclude(file) {
  const excludedFiles = [outputFile, 'node_modules'];
  return !excludedFiles.includes(file);
}

function processDirectory(dir, output, filesList) {
  try {
    const files = fs.readdirSync(dir);
    files.forEach((file) => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        if (shouldInclude(file)) {
          processDirectory(fullPath, output, filesList);
        }
      } else {
        filesList.push(fullPath);
      }
    });
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message);
  }
}

function appendFileContent(filePath, output) {
  try {
    output.push(`# File: ${filePath}\n`);
    output.push(fs.readFileSync(filePath, 'utf-8'));
    output.push('\n\n');
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
  }
}

function main() {
  const output = [];
  const filesList = [];

  // Collect all files in the root directory (ignoring specific ones like node_modules)
  const rootFiles = fs.readdirSync(rootDirectory).filter((file) => {
    const fullPath = path.join(rootDirectory, file);
    return fs.statSync(fullPath).isFile() && shouldInclude(file);
  });

  rootFiles.forEach((file) => {
    filesList.push(path.join(rootDirectory, file));
  });

  // Collect all files in the src directory recursively
  processDirectory(srcDirectory, output, filesList);

  // Start progress bar
  progressBar.start(filesList.length, 0);

  // Append each file content to output
  filesList.forEach((file, index) => {
    appendFileContent(file, output);
    progressBar.update(index + 1);
  });

  // Stop progress bar
  progressBar.stop();

  // Write the combined output to a file
  try {
    fs.writeFileSync(outputFile, output.join(''));
    console.log(`Combined source written to ${outputFile}`);
  } catch (error) {
    console.error(`Error writing to output file ${outputFile}:`, error.message);
  }
}

main();
