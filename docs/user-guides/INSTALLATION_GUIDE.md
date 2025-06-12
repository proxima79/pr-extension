# 📦 Installation Guide - Smart PR Creator Extension

## 🚀 Quick Installation

### Method 1: Install from Source (Development)

Since this is a development version, you'll need to build and install it manually:

#### **Step 1: Build the Extension**
```bash
# Navigate to the extension directory
cd /home/kenr/Repos/Ken/pr-extension

# Install dependencies
npm install

# Build the extension
npm run compile
```

#### **Step 2: Package the Extension**
```bash
# Install vsce (VS Code Extension manager) if you don't have it
npm install -g @vscode/vsce

# Package the extension
vsce package
```

This creates a `.vsix` file (e.g., `smart-pr-creator-0.0.1.vsix`)

#### **Step 3: Install in VS Code**
```bash
# Install the packaged extension
code --install-extension smart-pr-creator-0.0.1.vsix
```

**OR** manually in VS Code:
1. Open VS Code
2. Press `Ctrl+Shift+P` → `Extensions: Install from VSIX...`
3. Select the `.vsix` file you created
4. Reload VS Code when prompted

### Method 2: Development Mode (for testing)

For development and testing:

```bash
# Navigate to extension directory
cd /home/kenr/Repos/Ken/pr-extension

# Install dependencies
npm install

# Build and watch for changes
npm run watch
```

Then in VS Code:
1. Open the extension folder (`/home/kenr/Repos/Ken/pr-extension`)
2. Press `F5` to launch Extension Development Host
3. Test the extension in the new VS Code window

## ✅ Prerequisites Setup

### 1. **Azure CLI Installation**

#### Ubuntu/Debian:
```bash
# Method 1: Microsoft repository
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Method 2: Using snap
sudo snap install azure-cli --classic
```

#### Arch Linux:
```bash
# Using AUR
yay -S azure-cli

# Or using official repository
sudo pacman -S azure-cli
```

#### Verify installation:
```bash
az --version
```

### 2. **Azure DevOps Extension**

```bash
# Install Azure DevOps extension
az extension add --name azure-devops

# Verify installation
az extension list
```

### 3. **Azure Login & Configuration**

```bash
# Login to Azure
az login

# Set default organization (optional)
az devops configure --defaults organization=https://dev.azure.com/YourOrg

# Set default project (optional)
az devops configure --defaults project=YourProject
```

### 4. **GitHub Copilot Setup (Recommended)**

1. **Subscribe to GitHub Copilot** (if not already)
2. **Install GitHub Copilot extension in VS Code**:
   - Open VS Code
   - Go to Extensions (`Ctrl+Shift+X`)
   - Search for "GitHub Copilot"
   - Install the official GitHub Copilot extension
3. **Sign in to GitHub** when prompted

### 5. **Repository Requirements**

- ✅ Azure DevOps hosted Git repository
- ✅ Push access to the repository
- ✅ Local Git repository cloned

## 🔧 Post-Installation Setup

### 1. **Verify Installation**

After installing the extension:

1. **Open VS Code** in your Azure DevOps repository
2. **Press `Ctrl+Shift+P`**
3. **Type "Smart PR Creator"** - you should see the commands:
   - `Smart PR Creator: Create Pull Request`
   - `Smart PR Creator: Create PR with AI Description`
   - `Smart PR Creator: Check Azure CLI Status`
   - etc.

### 2. **Check Azure CLI Status**

1. **Command Palette** (`Ctrl+Shift+P`)
2. **Run**: `Smart PR Creator: Check Azure CLI Status`
3. **Verify** all checks pass:
   - ✅ Azure CLI installed
   - ✅ DevOps extension installed
   - ✅ Authenticated
   - ✅ Organization/project configured

### 3. **Configure Teams Webhook (Optional)**

If you want Teams notifications:

1. **Command Palette** → `Smart PR Creator: Configure Webhooks`
2. **Add your Teams webhook URL**
3. **Test the connection**

See `TEAMS_SETUP_GUIDE.md` for detailed instructions.

## 🎯 First Use

### Create Your First PR

1. **Make some changes** to your code
2. **Commit and push** to a feature branch
3. **Open Command Palette** (`Ctrl+Shift+P`)
4. **Run**: `Smart PR Creator: Create PR with AI Description`
5. **Follow the wizard**:
   - Select target branch
   - Review AI-generated title and description
   - Add reviewers
   - Create the PR

### Expected Workflow

```bash
# 1. Make changes
git checkout -b feature/new-feature
# ... make changes ...
git add .
git commit -m "Add new feature"
git push origin feature/new-feature

# 2. In VS Code:
# Ctrl+Shift+P → "Smart PR Creator: Create PR with AI Description"

# 3. Follow the guided wizard
# 4. PR created automatically in Azure DevOps!
```

## 🛠️ Troubleshooting

### Common Issues

#### **"Azure CLI not found"**
```bash
# Check if Azure CLI is in PATH
which az

# If not installed, install it:
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
```

#### **"DevOps extension not found"**
```bash
# Install the extension
az extension add --name azure-devops

# Update if already installed
az extension update --name azure-devops
```

#### **"Not authenticated"**
```bash
# Login again
az login

# Check current account
az account show
```

#### **"No repository found"**
- ✅ Ensure you're in a Git repository
- ✅ Verify the repository is Azure DevOps hosted
- ✅ Check remote URLs: `git remote -v`

#### **"GitHub Copilot not working"**
- ✅ Verify GitHub Copilot extension is installed
- ✅ Check you're signed in to GitHub
- ✅ Ensure you have an active Copilot subscription

### Debug Steps

1. **Check VS Code Output**:
   - View → Output → Select "Smart PR Creator"
   - Look for error messages

2. **Test Azure CLI manually**:
   ```bash
   az repos list --organization https://dev.azure.com/YourOrg
   ```

3. **Verify Git configuration**:
   ```bash
   git config --list
   git remote -v
   ```

## 📚 Additional Resources

- **`TEAMS_SETUP_GUIDE.md`** - Teams webhook setup
- **`DEVELOPMENT.md`** - Technical documentation  
- **`WEBHOOK_INTEGRATION_GUIDE.md`** - Webhook details
- **Package.json** - Full command list and configuration options

## 🔄 Updating the Extension

To update to a newer version:

```bash
# Build new version
cd /home/kenr/Repos/Ken/pr-extension
npm run compile
vsce package

# Install new version
code --install-extension smart-pr-creator-0.0.2.vsix

# Or reload VS Code in development mode
```

---

**Ready to streamline your PR workflow with AI-powered automation!** 🚀
