// FILE: frontend/public/js/registry/ui.js

/**
 * A manager object for all UI-related tasks on the registry page.
 * It depends on a state object and a DOM cache to function.
 */
export function createUIManager(state, DOM) {
    const uiManager = {
        populateFilters(categories, offices, employees) {
            const populate = (selectElement, data, valueKey = 'name', textKey = 'name') => {
                if (!selectElement) return;
                // Clear existing options except the first one
                while (selectElement.options.length > 1) {
                    selectElement.remove(1);
                }
                data.forEach(item => {
                    const option = document.createElement('option');
                    option.value = item[valueKey];
                    option.textContent = item[textKey];
                    selectElement.appendChild(option);
                });
            };
            populate(DOM.categoryFilter, categories);
            populate(DOM.officeFilter, offices);
            populate(DOM.transferOfficeSelect, offices);
            populate(DOM.transferCustodianSelect, employees);
        },

        setLoading(isLoading) {
            if (!DOM.tableBody) return;
            if (isLoading) {
                DOM.tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-gray-500">
                    <div class="flex justify-center items-center gap-2">
                        <i data-lucide="loader-2" class="animate-spin h-5 w-5"></i> Loading assets...
                    </div>
                </td></tr>`;
                lucide.createIcons();
            } else {
                DOM.tableBody.innerHTML = '';
            }
        },

        renderAssetTable(assets, totalAssets, totalPages) {
            if (!DOM.tableBody) return;

            this.setLoading(false);
            if (assets.length === 0) {
                DOM.tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-gray-500">No assets found matching your criteria.</td></tr>`;
            } else {
                assets.forEach(asset => DOM.tableBody.appendChild(this.createAssetRow(asset)));
            }

            // Add sort indicators to headers
            DOM.tableHeader.querySelectorAll('th[data-sort-key]').forEach(th => {
                th.classList.remove('bg-gray-200');
                th.innerHTML = th.innerHTML.replace(/ <i.*><\/i>$/, ''); // Remove old icon
                if (th.dataset.sortKey === state.sortKey) {
                    th.classList.add('bg-gray-200');
                    const icon = state.sortDirection === 'asc' ? 'arrow-up' : 'arrow-down';
                    th.innerHTML += ` <i data-lucide="${icon}" class="inline-block h-4 w-4"></i>`;
                }
            });

            lucide.createIcons();
            this.renderPagination(totalPages, totalAssets);
            this.updateSlipButtonVisibility();
        },

        createAssetRow(asset) {
            const tr = document.createElement('tr');
            const statusMap = { 'In Use': 'bg-green-100 text-green-800', 'For Repair': 'bg-yellow-100 text-yellow-800', 'In Storage': 'bg-blue-100 text-blue-800', 'Disposed': 'bg-red-100 text-red-800' };
            const isAssigned = !!asset.assignedPAR || !!asset.assignedICS;
            const isSelected = state.selectedAssetIds.includes(asset._id);
            const createdDate = asset.createdAt ? new Date(asset.createdAt).toLocaleString('en-CA', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }).replace(',', '') : 'N/A';

            tr.className = isAssigned ? "bg-gray-50 text-gray-500" : "bg-white hover:bg-gray-50";

            tr.innerHTML = `
                <td class="px-4 py-4 non-printable"><input type="checkbox" class="asset-checkbox" data-id="${asset._id}" ${isSelected ? 'checked' : ''}></td>
                <td class="px-6 py-4 font-medium">${asset.propertyNumber}${isAssigned ? `<span class="text-xs text-blue-600 block font-normal">Assigned: ${asset.assignedPAR || asset.assignedICS}</span>` : ''}</td>
                <td class="px-6 py-4">
                    <div class="font-medium text-gray-900">${asset.description}</div>
                    ${asset.specifications.map(s => `<div class="text-gray-500 text-xs">${s.key}: ${s.value}</div>`).join('')}
                </td>
                <td class="px-6 py-4">${asset.category}</td>
                <td class="px-6 py-4">
                    <div class="font-medium text-gray-900">${asset.custodian.name}</div>
                    <div class="text-gray-500 text-xs">${asset.custodian.office}</div>
                </td>
                <td class="px-6 py-4"><span class="px-3 py-1 text-xs font-semibold rounded-full ${statusMap[asset.status] || 'bg-gray-100 text-gray-800'}">${asset.status}</span></td>
                <td class="px-6 py-4 text-sm text-gray-500">${createdDate}</td>
                <td class="px-6 py-4 text-center non-printable">
                    <div class="flex justify-center items-center space-x-3">
                        <button class="edit-btn text-blue-600 hover:text-blue-800" title="Edit" data-id="${asset._id}"><i data-lucide="edit" class="h-4 w-4"></i></button>
                        <button class="transfer-btn text-green-600 hover:text-green-800" title="Transfer Asset" data-id="${asset._id}"><i data-lucide="arrow-right-left" class="h-4 w-4"></i></button>
                        <button class="property-card-btn text-purple-600 hover:text-purple-800" title="View Property Card" data-id="${asset._id}"><i data-lucide="book-open" class="h-4 w-4"></i></button>
                        <button class="delete-btn text-red-600 hover:text-red-800" title="Delete" data-id="${asset._id}"><i data-lucide="trash-2" class="h-4 w-4"></i></button>
                    </div>
                </td>
            `;
            return tr;
        },

        renderPagination(totalPages, totalItems) {
            if (!DOM.paginationControls) return;
            DOM.paginationControls.innerHTML = '';
            if (totalPages <= 1) return;

            DOM.paginationControls.innerHTML = `
                <span class="text-sm text-gray-700">
                    Showing <span class="font-semibold">${((state.currentPage - 1) * state.assetsPerPage) + 1}</span>
                    to <span class="font-semibold">${Math.min(state.currentPage * state.assetsPerPage, totalItems)}</span>
                    of <span class="font-semibold">${totalItems}</span> Results
                </span>
                <div class="inline-flex mt-2 xs:mt-0">
                    ${state.currentPage > 1 ? `<button id="prev-page-btn" class="px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-l hover:bg-gray-900">Prev</button>` : ''}
                    ${state.currentPage < totalPages ? `<button id="next-page-btn" class="px-4 py-2 text-sm font-medium text-white bg-gray-800 border-0 border-l border-gray-700 rounded-r hover:bg-gray-900">Next</button>` : ''}
                </div>
            `;
        },

        updateSlipButtonVisibility() {
            DOM.generateParBtn.classList.add('hidden');
            DOM.generateIcsBtn.classList.add('hidden');
            DOM.transferSelectedBtn.classList.add('hidden');

            if (state.selectedAssetIds.length > 0) {
                const selectedAssets = state.currentPageAssets.filter(asset => state.selectedAssetIds.includes(asset._id));

                DOM.transferSelectedBtn.classList.remove('hidden');

                const unassignedAssets = selectedAssets.filter(asset => !asset.assignedPAR && !asset.assignedICS);
                if (unassignedAssets.length === selectedAssets.length && selectedAssets.length > 0) {
                    const totalValue = selectedAssets.reduce((sum, asset) => sum + asset.acquisitionCost, 0);
                    const firstCustodian = selectedAssets[0].custodian.name;
                    const sameCustodian = selectedAssets.every(a => a.custodian.name === firstCustodian);

                    if (sameCustodian) {
                        if (totalValue >= 50000) {
                            DOM.generateParBtn.classList.remove('hidden');
                        } else {
                            DOM.generateIcsBtn.classList.remove('hidden');
                        }
                    }
                }
            }
        },

        openTransferModal(assetIds) {
            state.assetsToTransfer = state.currentPageAssets.filter(a => assetIds.includes(a._id));
            if (state.assetsToTransfer.length === 0) return;

            if (assetIds.length === 1) {
                const asset = state.assetsToTransfer[0];
                DOM.transferModalTitle.textContent = 'Transfer Asset';
                DOM.transferAssetInfo.innerHTML = `
                    <strong>Property No:</strong> ${asset.propertyNumber}<br>
                    <strong>Description:</strong> ${asset.description}<br>
                    <strong>Current Office:</strong> ${asset.office}<br>
                    <strong>Current Custodian:</strong> ${asset.custodian.name}
                `;
                DOM.transferAssetInfo.classList.remove('hidden');
                DOM.bulkTransferAssetListContainer.classList.add('hidden');
                DOM.confirmTransferBtn.textContent = 'Confirm Transfer';
            } else {
                DOM.transferModalTitle.textContent = `Transfer ${assetIds.length} Assets`;
                DOM.transferAssetInfo.classList.add('hidden');
                DOM.bulkTransferAssetListContainer.classList.remove('hidden');
                DOM.bulkTransferAssetListContainer.innerHTML = `
                    <p class="font-semibold mb-2">Assets to be transferred:</p>
                    <ul class="list-disc list-inside text-sm">
                        ${state.assetsToTransfer.map(a => `<li>${a.propertyNumber} - ${a.description}</li>`).join('')}
                    </ul>
                `;
                DOM.confirmTransferBtn.textContent = 'Confirm & Generate PTR';
            }

            DOM.transferModal.classList.remove('hidden');
        },

        closeTransferModal() {
            state.assetsToTransfer = [];
            DOM.transferModal.classList.add('hidden');
        }
    };

    return uiManager;
}
